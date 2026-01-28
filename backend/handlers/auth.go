package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
	"github.com/user/misignage/util"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func Login(c echo.Context) error {
	req := new(LoginRequest)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		util.LogAuditLogin(req.Email, false, c.RealIP(), "Invalid email")
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	if !auth.CheckPasswordHash(req.Password, user.PasswordHash) {
		util.LogAuditLogin(req.Email, false, c.RealIP(), "Invalid password")
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.OrganizationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	util.LogAuditLogin(req.Email, true, c.RealIP(), "")
	return c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User:  user,
	})
}

func Register(c echo.Context) error {
	req := new(models.User)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// In a real app, only an admin can register users, or it's part of an invite flow.
	// For now, let's assume open registration for the first user/org setup.

	password := c.FormValue("password")
	hash, err := auth.HashPassword(password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}

	req.PasswordHash = hash
	if err := db.DB.Create(&req).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
	}

	return c.JSON(http.StatusCreated, req)
}
