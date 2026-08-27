from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('', views.TrackedSatelliteViewSet, basename='satellite')

urlpatterns = router.urls
