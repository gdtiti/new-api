package openaicompat

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
)

func IsOpenAIDownstreamStrictUpstreamEnabled() bool {
	return model_setting.GetGlobalSettings().OpenAIDownstreamStrictUpstreamEnabled
}

func IsOpenAIDownstreamRequestPath(requestPath string) bool {
	path := strings.TrimSpace(requestPath)
	switch path {
	case "/v1/chat/completions", "/v1/responses":
		return true
	default:
		return strings.HasPrefix(path, "/v1/responses/compact")
	}
}

func ShouldRestrictOpenAIUpstreamByRequestPath(requestPath string) bool {
	return IsOpenAIDownstreamStrictUpstreamEnabled() && IsOpenAIDownstreamRequestPath(requestPath)
}

func IsOpenAIDownstreamRelayFormat(relayFormat types.RelayFormat) bool {
	switch relayFormat {
	case types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, types.RelayFormatOpenAIResponsesCompaction:
		return true
	default:
		return false
	}
}

func RequiresOpenAICompatibleUpstreamForRelayFormat(relayFormat types.RelayFormat) bool {
	if relayFormat == types.RelayFormatOpenAIResponsesCompaction {
		return true
	}
	return IsOpenAIDownstreamStrictUpstreamEnabled() && IsOpenAIDownstreamRelayFormat(relayFormat)
}

func IsAllowedOpenAIUpstreamAPIType(apiType int) bool {
	return apiType == constant.APITypeOpenAI || apiType == constant.APITypeCodex
}

func IsAllowedOpenAIUpstreamChannelType(channelType int) bool {
	apiType, _ := common.ChannelType2APIType(channelType)
	return IsAllowedOpenAIUpstreamAPIType(apiType)
}

func IsChannelTypeAllowedForRequestPath(channelType int, requestPath string) bool {
	if !ShouldRestrictOpenAIUpstreamByRequestPath(requestPath) {
		return true
	}
	return IsAllowedOpenAIUpstreamChannelType(channelType)
}

func IsAPITypeAllowedForRelayFormat(apiType int, relayFormat types.RelayFormat) bool {
	if !RequiresOpenAICompatibleUpstreamForRelayFormat(relayFormat) {
		return true
	}
	return IsAllowedOpenAIUpstreamAPIType(apiType)
}
