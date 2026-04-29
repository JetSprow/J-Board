BINARY := jboard-agent
VERSION := 3.0.1
LDFLAGS := -s -w

.PHONY: build build-linux clean

build:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/agent

build-linux:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(BINARY)-linux-amd64 ./cmd/agent
	GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o $(BINARY)-linux-arm64 ./cmd/agent

clean:
	rm -f $(BINARY) $(BINARY)-linux-amd64 $(BINARY)-linux-arm64
