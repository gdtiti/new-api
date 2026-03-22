package relay

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type responsesWSPrepareResult struct {
	request     *dto.OpenAIResponsesRequest
	createEvent map[string]any
	err         error
}

func TestPrepareOpenAIResponsesWSRequestValidatesAndForcesStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	resultCh := make(chan responsesWSPrepareResult, 1)
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			resultCh <- responsesWSPrepareResult{err: err}
			return
		}
		defer conn.Close()

		request, createEvent, newAPIError := PrepareOpenAIResponsesWSRequest(nil, conn)
		if newAPIError != nil {
			resultCh <- responsesWSPrepareResult{err: newAPIError}
			return
		}
		resultCh <- responsesWSPrepareResult{
			request:     request,
			createEvent: createEvent,
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	defer client.Close()

	payload := `{"type":"response.create","model":"gpt-5","input":"hello","stream":false}`
	if err := client.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		t.Fatalf("write websocket message: %v", err)
	}

	select {
	case result := <-resultCh:
		if result.err != nil {
			t.Fatalf("expected success, got %v", result.err)
		}
		if result.request == nil {
			t.Fatalf("expected parsed request")
		}
		if result.request.Model != "gpt-5" {
			t.Fatalf("expected model gpt-5, got %q", result.request.Model)
		}
		if result.request.Stream == nil || !*result.request.Stream {
			t.Fatalf("expected stream to be forced to true")
		}
		if got := result.createEvent["type"]; got != responsesWSCreateEventType {
			t.Fatalf("expected create event type %q, got %#v", responsesWSCreateEventType, got)
		}
		if got, ok := result.createEvent["stream"].(bool); !ok || !got {
			t.Fatalf("expected raw create event stream=true, got %#v", result.createEvent["stream"])
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for websocket prepare result")
	}
}

func TestPrepareOpenAIResponsesWSRequestRejectsMissingModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	resultCh := make(chan responsesWSPrepareResult, 1)
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			resultCh <- responsesWSPrepareResult{err: err}
			return
		}
		defer conn.Close()

		_, _, newAPIError := PrepareOpenAIResponsesWSRequest(nil, conn)
		if newAPIError == nil {
			resultCh <- responsesWSPrepareResult{}
			return
		}
		resultCh <- responsesWSPrepareResult{err: newAPIError}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	defer client.Close()

	payload := `{"type":"response.create","input":"hello"}`
	if err := client.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		t.Fatalf("write websocket message: %v", err)
	}

	select {
	case result := <-resultCh:
		if result.err == nil {
			t.Fatal("expected invalid request error for missing model")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for websocket prepare error")
	}
}
