package util

import (
	"fmt"
	"log"

	"github.com/labstack/echo/v4"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
)

var DebugMode bool

func LogSub(orgID uint, source, level, message string, slideID uint) {
	if DebugMode || level == "error" {
		if slideID != 0 {
			log.Printf("[%s] [%s] (Slide %d) %s", source, level, slideID, message)
		} else {
			log.Printf("[%s] [%s] %s", source, level, message)
		}
	}

	// Always save to DB for the "Logs" section
	db.DB.Create(&models.SystemLog{
		OrganizationID: orgID,
		Source:         source,
		Level:          level,
		Message:        message,
		SlideID:        slideID,
	})
}

func LogInfo(orgID uint, source, message string, slideID uint) {
	LogSub(orgID, source, "info", message, slideID)
}

func LogDebug(orgID uint, source, message string, slideID uint) {
	LogSub(orgID, source, "debug", message, slideID)
}

func LogError(orgID uint, source, message string, slideID uint) {
	LogSub(orgID, source, "error", message, slideID)
}

func LogErrorf(orgID uint, source string, slideID uint, format string, v ...interface{}) {
	LogSub(orgID, source, "error", fmt.Sprintf(format, v...), slideID)
}

func LogInfof(orgID uint, source string, slideID uint, format string, v ...interface{}) {
	LogSub(orgID, source, "info", fmt.Sprintf(format, v...), slideID)
}

func LogDebugf(orgID uint, source string, slideID uint, format string, v ...interface{}) {
	LogSub(orgID, source, "debug", fmt.Sprintf(format, v...), slideID)
}

func LogAudit(c echo.Context, action, entity string, entityID uint, details string) {
	// Extract UserID if available
	var userID *uint
	var orgID uint

	user := c.Get("user")
	if user != nil {
		if claims, ok := user.(*auth.JwtCustomClaims); ok {
			userID = &claims.UserID
			orgID = claims.OrganizationID
		}
	}

	ip := c.RealIP()

	// Console log for audit (always useful)
	if DebugMode {
		log.Printf("[AUDIT] User %v | Action %s | Entity %s:%d | IP %s | %s", userID, action, entity, entityID, ip, details)
	}

	db.DB.Create(&models.SystemLog{
		OrganizationID: orgID,
		Source:         "audit",
		Level:          "info",
		Message:        details,
		UserID:         userID,
		Action:         action,
		Entity:         entity,
		EntityID:       entityID,
		IPAddress:      ip,
	})
}

func LogAuditLogin(email string, success bool, ip string, reason string) {
	status := "SUCCESS"
	if !success {
		status = "FAILED"
	}
	message := fmt.Sprintf("Login %s for %s. Reason: %s", status, email, reason)
	if success {
		message = fmt.Sprintf("Login SUCCESS for %s", email)
	}

	if DebugMode {
		log.Printf("[AUDIT] [LOGIN] %s | IP %s", message, ip)
	}

	db.DB.Create(&models.SystemLog{
		Source:    "audit",
		Level:     "info",
		Message:   message,
		Action:    "LOGIN",
		Entity:    "USER",
		IPAddress: ip,
	})
}
