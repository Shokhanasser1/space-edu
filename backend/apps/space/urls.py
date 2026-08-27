from django.urls import path

from . import views

urlpatterns = [
    path('gp/', views.GpView.as_view(), name='space_gp'),
    path('ephemeris/', views.EphemerisView.as_view(), name='space_ephemeris'),
    path('launches/', views.LaunchesView.as_view(), name='space_launches'),
    path('apod/', views.ApodView.as_view(), name='space_apod'),
]
