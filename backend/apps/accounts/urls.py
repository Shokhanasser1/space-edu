from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('email-code/request/', views.EmailLoginCodeRequestView.as_view()),
    path('email-code/verify/', views.EmailLoginCodeVerifyView.as_view()),
    path('email/verify/request/', views.EmailVerifyRequestView.as_view()),
    path('email/verify/confirm/', views.EmailVerifyConfirmView.as_view()),
    path('email/change/request/', views.EmailChangeRequestView.as_view()),
    path('email/change/confirm/', views.EmailChangeConfirmView.as_view()),
    path('email/change/cancel/', views.EmailChangeCancelView.as_view()),
    path('password/reset/request/', views.PasswordResetRequestView.as_view()),
    path('password/reset/confirm/', views.PasswordResetConfirmView.as_view()),
    path('password/change/', views.PasswordChangeView.as_view()),
    path('google/', views.GoogleAuthView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('me/', views.MeView.as_view()),
    path('delete/', views.DeleteAccountView.as_view()),
]
