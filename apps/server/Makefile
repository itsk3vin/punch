.PHONY: dev build run test lint fmt tidy

BIN := bin/server

dev:
	go run ./cmd/server

build:
	go build -o $(BIN) ./cmd/server

run: build
	./$(BIN)

test:
	go test ./... -race -count=1

lint:
	go vet ./...

fmt:
	gofmt -w .

tidy:
	go mod tidy
