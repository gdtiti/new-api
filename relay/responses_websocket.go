package relay

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	responsesWSCreateEventType     = "response.create"
	responsesWSCompletedEventType  = "response.completed"
	responsesWSFailedEventType     = "response.failed"
	responsesWSIncompleteEventType = "response.incomplete"
	responsesWSErrorEventType      = "response.error"
	responsesWSErrorType           = "error"
	responsesWSFileSearchCallType  = "file_search_call"
)

func PrepareOpenAIResponsesWSRequest(c *gin.Context, ws *websocket.Conn) (*dto.OpenAIResponsesRequest, map[string]any, *types.NewAPIError) {
	if ws == nil {
		return nil, nil, types.NewErrorWithStatusCode(
			fmt.Errorf("websocket connection is nil"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	messageType, payload, err := ws.ReadMessage()
	if err != nil {
		return nil, nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
		return nil, nil, types.NewErrorWithStatusCode(
			fmt.Errorf("unsupported websocket message type: %d", messageType),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	createEvent := make(map[string]any)
	if err := common.Unmarshal(payload, &createEvent); err != nil {
		return nil, nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if common.Interface2String(createEvent["type"]) != responsesWSCreateEventType {
		return nil, nil, types.NewErrorWithStatusCode(
			fmt.Errorf("first websocket event must be %q", responsesWSCreateEventType),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	eventPayload := make(map[string]any, len(createEvent))
	for key, value := range createEvent {
		if key == "type" {
			continue
		}
		eventPayload[key] = value
	}

	jsonData, err := common.Marshal(eventPayload)
	if err != nil {
		return nil, nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request := &dto.OpenAIResponsesRequest{}
	if err := common.Unmarshal(jsonData, request); err != nil {
		return nil, nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if strings.TrimSpace(request.Model) == "" {
		return nil, nil, types.NewErrorWithStatusCode(
			fmt.Errorf("responses websocket request missing model"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if isEmptyResponsesWSInput(request.Input) {
		return nil, nil, types.NewErrorWithStatusCode(
			fmt.Errorf("responses websocket request missing input"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	stream := true
	request.Stream = &stream
	createEvent["stream"] = true
	createEvent["type"] = responsesWSCreateEventType
	return request, createEvent, nil
}

func ResponsesWssHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil {
		return types.NewError(fmt.Errorf("relay info is nil"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	info.InitChannelMeta(c)
	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	restoreTarget := applyResponsesWSChannelOverrides(info)
	if restoreTarget != nil {
		defer restoreTarget()
	}

	targetConn, err := relaychannel.DoWssRequest(adaptor, c, info, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}
	info.TargetWs = targetConn
	defer info.TargetWs.Close()

	createPayload, payloadErr := buildOpenAIResponsesWSCreatePayload(c, info, adaptor)
	if payloadErr != nil {
		return payloadErr
	}
	if err := targetConn.WriteMessage(websocket.TextMessage, createPayload); err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}

	usage := &dto.Usage{}
	var responseText strings.Builder
	terminalSeen := false

	for {
		messageType, message, err := targetConn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) && terminalSeen {
				break
			}
			return types.NewError(err, types.ErrorCodeBadResponse)
		}
		info.SetFirstResponseTime()
		if err := info.ClientWs.WriteMessage(messageType, message); err != nil {
			return types.NewError(err, types.ErrorCodeBadResponse)
		}

		terminal, relayErr := consumeResponsesWSUpstreamEvent(c, info, message, usage, &responseText)
		if relayErr != nil {
			c.Set("responses_ws_error_already_sent", true)
			return relayErr
		}
		if terminal {
			terminalSeen = true
			break
		}
	}

	if usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	if strings.HasPrefix(info.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, info, usage, "")
	} else {
		service.PostTextConsumeQuota(c, info, usage, nil)
	}
	return nil
}

func isEmptyResponsesWSInput(input []byte) bool {
	trimmed := bytes.TrimSpace(input)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return true
	}

	switch common.GetJsonType(trimmed) {
	case "string":
		var value string
		_ = common.Unmarshal(trimmed, &value)
		return strings.TrimSpace(value) == ""
	case "array":
		var values []any
		_ = common.Unmarshal(trimmed, &values)
		return len(values) == 0
	}
	return false
}

func applyResponsesWSChannelOverrides(info *relaycommon.RelayInfo) func() {
	if info == nil {
		return nil
	}

	originalBaseURL := info.ChannelBaseUrl
	originalPath := info.RequestURLPath
	changed := false

	if baseURL := strings.TrimSpace(info.ChannelOtherSettings.OpenAIResponsesWSBaseURL); baseURL != "" {
		info.ChannelBaseUrl = strings.TrimRight(baseURL, "/")
		changed = true
	}
	if path := strings.TrimSpace(info.ChannelOtherSettings.OpenAIResponsesWSPath); path != "" {
		if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		info.RequestURLPath = path
		changed = true
	}
	if !changed {
		return nil
	}

	return func() {
		info.ChannelBaseUrl = originalBaseURL
		info.RequestURLPath = originalPath
	}
}

func buildOpenAIResponsesWSCreatePayload(c *gin.Context, info *relaycommon.RelayInfo, adaptor relaychannel.Adaptor) ([]byte, *types.NewAPIError) {
	request, ok := info.Request.(*dto.OpenAIResponsesRequest)
	if !ok {
		return nil, types.NewError(
			fmt.Errorf("invalid request type for responses websocket: %T", info.Request),
			types.ErrorCodeInvalidRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	requestCopy, err := common.DeepCopy(request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, info, *requestCopy)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	convertedEvent := make(map[string]any)
	if err := common.Unmarshal(jsonData, &convertedEvent); err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	mergedEvent := make(map[string]any, len(info.ResponsesWSCreateEvent)+len(convertedEvent)+2)
	for key, value := range info.ResponsesWSCreateEvent {
		mergedEvent[key] = value
	}
	for key, value := range convertedEvent {
		mergedEvent[key] = value
	}
	mergedEvent["type"] = responsesWSCreateEventType
	mergedEvent["stream"] = true

	payload, err := common.Marshal(mergedEvent)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	return payload, nil
}

func consumeResponsesWSUpstreamEvent(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	message []byte,
	usage *dto.Usage,
	responseText *strings.Builder,
) (bool, *types.NewAPIError) {
	var streamResponse dto.ResponsesStreamResponse
	if err := common.Unmarshal(message, &streamResponse); err != nil {
		return false, nil
	}

	switch streamResponse.Type {
	case responsesWSCompletedEventType:
		applyResponsesUsageFromResponse(c, info, usage, streamResponse.Response)
		return true, nil
	case responsesWSIncompleteEventType:
		applyResponsesUsageFromResponse(c, info, usage, streamResponse.Response)
		return true, nil
	case "response.output_text.delta":
		responseText.WriteString(streamResponse.Delta)
	case dto.ResponsesOutputTypeItemDone:
		if streamResponse.Item != nil {
			switch streamResponse.Item.Type {
			case dto.BuildInCallWebSearchCall:
				increaseResponsesToolCount(info, dto.BuildInToolWebSearchPreview)
			case responsesWSFileSearchCallType:
				increaseResponsesToolCount(info, dto.BuildInToolFileSearch)
			}
		}
	case responsesWSErrorEventType, responsesWSFailedEventType, responsesWSErrorType:
		applyResponsesUsageFromResponse(c, info, usage, streamResponse.Response)
		if oaiErr := extractResponsesWSError(message, streamResponse); oaiErr != nil {
			return false, types.WithOpenAIError(*oaiErr, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
		}
		return false, types.NewOpenAIError(
			fmt.Errorf("responses websocket upstream error: %s", streamResponse.Type),
			types.ErrorCodeBadResponse,
			http.StatusInternalServerError,
			types.ErrOptionWithSkipRetry(),
		)
	}

	return false, nil
}

func applyResponsesUsageFromResponse(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage, response *dto.OpenAIResponsesResponse) {
	if usage == nil || response == nil {
		return
	}

	if response.Usage != nil {
		if response.Usage.InputTokens != 0 {
			usage.PromptTokens = response.Usage.InputTokens
		}
		if response.Usage.OutputTokens != 0 {
			usage.CompletionTokens = response.Usage.OutputTokens
		}
		if response.Usage.TotalTokens != 0 {
			usage.TotalTokens = response.Usage.TotalTokens
		} else {
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
		if response.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = response.Usage.InputTokensDetails.CachedTokens
			usage.PromptTokensDetails.ImageTokens = response.Usage.InputTokensDetails.ImageTokens
			usage.PromptTokensDetails.AudioTokens = response.Usage.InputTokensDetails.AudioTokens
		}
		if response.Usage.CompletionTokenDetails.ReasoningTokens != 0 {
			usage.CompletionTokenDetails.ReasoningTokens = response.Usage.CompletionTokenDetails.ReasoningTokens
		}
	}

	if response.HasImageGenerationCall() {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_quality", response.GetQuality())
		c.Set("image_generation_call_size", response.GetSize())
	}

	for _, tool := range response.Tools {
		increaseResponsesToolCount(info, common.Interface2String(tool["type"]))
	}
}

func increaseResponsesToolCount(info *relaycommon.RelayInfo, toolType string) {
	if info == nil || info.ResponsesUsageInfo == nil || info.ResponsesUsageInfo.BuiltInTools == nil {
		return
	}
	if tool, ok := info.ResponsesUsageInfo.BuiltInTools[toolType]; ok && tool != nil {
		tool.CallCount++
	}
}

func extractResponsesWSError(message []byte, streamResponse dto.ResponsesStreamResponse) *types.OpenAIError {
	if streamResponse.Response != nil {
		if openAIError := streamResponse.Response.GetOpenAIError(); openAIError != nil && openAIError.Type != "" {
			return openAIError
		}
	}

	var rawEvent struct {
		Error any `json:"error,omitempty"`
	}
	if err := common.Unmarshal(message, &rawEvent); err == nil {
		if openAIError := dto.GetOpenAIError(rawEvent.Error); openAIError != nil && openAIError.Type != "" {
			return openAIError
		}
	}
	return nil
}
