# Multi-stage: build a static Go binary, ship it on distroless.
FROM golang:1.25-alpine AS build
WORKDIR /src

# Cache module downloads separately from the source.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO_ENABLED=0 keeps the binary fully static (modernc.org/sqlite is pure Go).
RUN CGO_ENABLED=0 GOFLAGS=-buildvcs=false go build -o /server .

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server
ENV PORT=8787 DATA_DIR=/data
EXPOSE 8787
VOLUME ["/data"]
ENTRYPOINT ["/server"]
