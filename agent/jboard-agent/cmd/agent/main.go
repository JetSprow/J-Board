package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"

	"github.com/jboard/jboard-agent/internal/config"
	"github.com/jboard/jboard-agent/internal/probe"
)

const version = "3.0.1"

func main() {
	debug.SetGCPercent(50)

	cfg := config.Load()
	log.Printf("[agent] jboard-agent v%s starting in probe-only mode — server=%s", version, cfg.ServerURL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go probe.LatencyLoop(ctx, cfg)
	go probe.TraceLoop(ctx, cfg)
	go probe.XrayAccessLogLoop(ctx, cfg)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("[agent] shutting down...")
	cancel()
}
