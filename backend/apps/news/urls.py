from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('', views.NewsArticleViewSet, basename='news')

# Both named routes come **before** the router's. The viewset is registered at
# the empty prefix, so its detail route is `news/<pk>/` with a lookup pattern
# of `[^/.]+` — which matches the literal string "on-this-day" and would
# answer 404 from `get_object()` instead of the anniversary. Order is the only
# thing separating the two, so a route added after these needs the same care.
# There is a test.
urlpatterns = [
    path('on-this-day/', views.OnThisDayView.as_view(), name='news_on_this_day'),
    path('telegram/', views.TelegramView.as_view(), name='news_telegram'),
] + router.urls
