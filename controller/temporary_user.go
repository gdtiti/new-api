package controller

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type manageTemporaryUserRequest struct {
	Id     int    `json:"id"`
	Action string `json:"action"`
}

func CreateTemporaryUser(c *gin.Context) {
	var req service.CreateTemporaryUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	result, err := service.CreateTemporaryUser(c.GetInt("id"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetTemporaryUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetTemporaryUsersPage(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func ManageTemporaryUser(c *gin.Context) {
	var req manageTemporaryUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Id <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}

	action := strings.TrimSpace(req.Action)
	switch action {
	case "enable", "disable":
	default:
		common.ApiErrorMsg(c, "不支持的操作")
		return
	}

	if err := model.SetTemporaryUserAvailability(req.Id, action == "enable"); err != nil {
		common.ApiError(c, err)
		return
	}

	user, err := model.GetUserById(req.Id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	actionText := "禁用"
	if action == "enable" {
		actionText = "启用"
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeManage, fmt.Sprintf("管理员%s临时账号 %s(%d)", actionText, user.Username, user.Id))

	common.ApiSuccess(c, gin.H{
		"id":     user.Id,
		"status": user.Status,
	})
}
