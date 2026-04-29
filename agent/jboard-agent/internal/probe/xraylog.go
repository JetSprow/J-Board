package probe

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jboard/jboard-agent/internal/config"
)

const maxXrayReadBytes int64 = 2 * 1024 * 1024
const maxXrayEventsPerPush = 300

var xrayAccessLinePattern = regexp.MustCompile(`^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(?:from\s+)?(\S+)\s+(accepted|rejected)\s+(?:(tcp|udp):)?(\S+)\s+\[([^\]]+)\](?:.*?\bemail:\s*([^\s]+))?`)

type xrayLogState struct {
	Path   string `json:"path"`
	Inode  uint64 `json:"inode"`
	Offset int64  `json:"offset"`
}

type nodeAccessEvent struct {
	ClientEmail       string `json:"clientEmail"`
	SourceIP          string `json:"sourceIp"`
	InboundTag        string `json:"inboundTag,omitempty"`
	Network           string `json:"network,omitempty"`
	TargetHost        string `json:"targetHost,omitempty"`
	TargetPort        int    `json:"targetPort,omitempty"`
	Action            string `json:"action"`
	ConnectionCount   int    `json:"connectionCount"`
	UniqueTargetCount int    `json:"uniqueTargetCount,omitempty"`
	FirstSeenAt       string `json:"firstSeenAt,omitempty"`
	LastSeenAt        string `json:"lastSeenAt,omitempty"`
}

type nodeAccessPayload struct {
	Events []nodeAccessEvent `json:"events"`
}

type parsedXrayAccess struct {
	ClientEmail string
	SourceIP    string
	InboundTag  string
	Network     string
	TargetHost  string
	TargetPort  int
	Action      string
	SeenAt      time.Time
}

type accessAggregate struct {
	event   nodeAccessEvent
	targets map[string]struct{}
}

func XrayAccessLogLoop(ctx context.Context, cfg *config.Config) {
	if strings.TrimSpace(cfg.XrayAccessLogPath) == "" {
		log.Println("[xray-log] disabled; set XRAY_ACCESS_LOG_PATH to enable node access risk telemetry")
		return
	}

	ticker := time.NewTicker(cfg.XrayLogInterval)
	defer ticker.Stop()

	collectAndPushXrayLogs(cfg)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			collectAndPushXrayLogs(cfg)
		}
	}
}

func collectAndPushXrayLogs(cfg *config.Config) {
	events, state, err := readNewXrayEvents(cfg)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Printf("[xray-log] read error: %v", err)
		}
		return
	}
	if len(events) == 0 {
		if err := saveXrayLogState(cfg.XrayLogStateFile, state); err != nil {
			log.Printf("[xray-log] state save error: %v", err)
		}
		return
	}

	payload := nodeAccessPayload{Events: events}
	body, _ := json.Marshal(payload)
	if err := postToServer(cfg, "/api/agent/node-access", body); err != nil {
		log.Printf("[xray-log] push error: %v", err)
		return
	}
	if err := saveXrayLogState(cfg.XrayLogStateFile, state); err != nil {
		log.Printf("[xray-log] state save error: %v", err)
	}
	log.Printf("[xray-log] pushed %d aggregate access events", len(events))
}

func readNewXrayEvents(cfg *config.Config) ([]nodeAccessEvent, xrayLogState, error) {
	path := strings.TrimSpace(cfg.XrayAccessLogPath)
	info, err := os.Stat(path)
	if err != nil {
		return nil, xrayLogState{}, err
	}
	inode := fileInode(info)
	state := loadXrayLogState(cfg.XrayLogStateFile)

	if state.Path != path || state.Inode != inode || state.Offset > info.Size() {
		state = xrayLogState{Path: path, Inode: inode}
		if cfg.XrayLogStartAtEnd {
			state.Offset = info.Size()
		}
	}

	if info.Size() <= state.Offset {
		return nil, state, nil
	}

	readBytes := info.Size() - state.Offset
	if readBytes > maxXrayReadBytes {
		readBytes = maxXrayReadBytes
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, state, err
	}
	defer file.Close()

	buf := make([]byte, readBytes)
	n, err := file.ReadAt(buf, state.Offset)
	if err != nil && n == 0 {
		return nil, state, err
	}
	data := string(buf[:n])
	consumed := int64(n)
	if lastNewline := strings.LastIndexByte(data, '\n'); lastNewline >= 0 && lastNewline < len(data)-1 {
		data = data[:lastNewline+1]
		consumed = int64(len(data))
	}
	state.Offset += consumed

	events := aggregateXrayAccessLines(strings.Split(data, "\n"))
	if len(events) > maxXrayEventsPerPush {
		events = events[:maxXrayEventsPerPush]
	}

	return events, state, nil
}

func loadXrayLogState(path string) xrayLogState {
	data, err := os.ReadFile(path)
	if err != nil {
		return xrayLogState{}
	}
	var state xrayLogState
	if err := json.Unmarshal(data, &state); err != nil {
		return xrayLogState{}
	}
	return state
}

func saveXrayLogState(path string, state xrayLogState) error {
	if strings.TrimSpace(path) == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.Marshal(state)
	return os.WriteFile(path, data, 0o600)
}

func fileInode(info os.FileInfo) uint64 {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || stat == nil {
		return 0
	}
	return uint64(stat.Ino)
}

func aggregateXrayAccessLines(lines []string) []nodeAccessEvent {
	aggregates := make(map[string]*accessAggregate)
	var order []string

	for _, line := range lines {
		parsed, ok := parseXrayAccessLine(line)
		if !ok || parsed.ClientEmail == "" || parsed.SourceIP == "" {
			continue
		}
		key := strings.Join([]string{
			parsed.ClientEmail,
			parsed.SourceIP,
			parsed.InboundTag,
			parsed.Network,
			parsed.Action,
		}, "|")

		agg, ok := aggregates[key]
		if !ok {
			agg = &accessAggregate{
				event: nodeAccessEvent{
					ClientEmail:     parsed.ClientEmail,
					SourceIP:        parsed.SourceIP,
					InboundTag:      parsed.InboundTag,
					Network:         parsed.Network,
					TargetHost:      parsed.TargetHost,
					TargetPort:      parsed.TargetPort,
					Action:          parsed.Action,
					ConnectionCount: 0,
					FirstSeenAt:     parsed.SeenAt.Format(time.RFC3339),
					LastSeenAt:      parsed.SeenAt.Format(time.RFC3339),
				},
				targets: make(map[string]struct{}),
			}
			aggregates[key] = agg
			order = append(order, key)
		}

		agg.event.ConnectionCount++
		if parsed.TargetHost != "" {
			agg.targets[parsed.TargetHost] = struct{}{}
		}
		if parsed.SeenAt.After(parseRFC3339OrZero(agg.event.LastSeenAt)) {
			agg.event.LastSeenAt = parsed.SeenAt.Format(time.RFC3339)
		}
	}

	events := make([]nodeAccessEvent, 0, len(order))
	for _, key := range order {
		agg := aggregates[key]
		agg.event.UniqueTargetCount = len(agg.targets)
		events = append(events, agg.event)
	}
	return events
}

func parseXrayAccessLine(line string) (parsedXrayAccess, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return parsedXrayAccess{}, false
	}
	match := xrayAccessLinePattern.FindStringSubmatch(line)
	if len(match) == 0 {
		return parsedXrayAccess{}, false
	}

	seenAt, err := time.ParseInLocation("2006/01/02 15:04:05", match[1], time.Local)
	if err != nil {
		seenAt = time.Now()
	}
	network := strings.ToLower(match[4])
	targetHost, targetPort := splitTarget(match[5])
	if network == "" {
		network = inferNetwork(match[5])
	}

	return parsedXrayAccess{
		ClientEmail: strings.TrimSpace(match[7]),
		SourceIP:    stripPort(match[2]),
		InboundTag:  normalizeInboundTag(match[6]),
		Network:     network,
		TargetHost:  targetHost,
		TargetPort:  targetPort,
		Action:      strings.ToLower(match[3]),
		SeenAt:      seenAt,
	}, true
}

func normalizeInboundTag(value string) string {
	parts := strings.Split(value, ">>")
	return strings.TrimSpace(parts[0])
}

func inferNetwork(target string) string {
	if strings.HasPrefix(strings.ToLower(target), "udp:") {
		return "udp"
	}
	return "tcp"
}

func splitTarget(value string) (string, int) {
	value = trimTransportPrefix(strings.TrimSpace(value))
	if host, port, err := net.SplitHostPort(value); err == nil {
		return strings.Trim(host, "[]"), atoiOrZero(port)
	}
	idx := strings.LastIndex(value, ":")
	if idx > 0 && idx < len(value)-1 {
		port := atoiOrZero(value[idx+1:])
		if port > 0 {
			return strings.Trim(value[:idx], "[]"), port
		}
	}
	return strings.Trim(value, "[]"), 0
}

func stripPort(value string) string {
	value = trimTransportPrefix(strings.TrimSpace(value))
	if host, _, err := net.SplitHostPort(value); err == nil {
		return strings.Trim(host, "[]")
	}
	idx := strings.LastIndex(value, ":")
	if idx > 0 && idx < len(value)-1 && atoiOrZero(value[idx+1:]) > 0 {
		return strings.Trim(value[:idx], "[]")
	}
	return strings.Trim(value, "[]")
}

func trimTransportPrefix(value string) string {
	lower := strings.ToLower(value)
	if strings.HasPrefix(lower, "tcp:") || strings.HasPrefix(lower, "udp:") {
		return value[4:]
	}
	return value
}

func atoiOrZero(value string) int {
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return n
}

func parseRFC3339OrZero(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}
