from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import MarketItem, MarketCategory, UserInventory, Wishlist, ItemReview


# ── Category ──
class MarketCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(source='items.count', read_only=True)

    class Meta:
        model = MarketCategory
        fields = ('id', 'slug', 'name_en', 'name_uz', 'name_ru', 'icon', 'color', 'order', 'item_count')


# ── MarketItem ──
class MarketItemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name_en', read_only=True, default=None)
    is_discount_active = serializers.BooleanField(read_only=True)
    effective_price = serializers.IntegerField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    # The client has to be able to tell a real product from a virtual one
    # without guessing from a URL string.
    is_external = serializers.BooleanField(read_only=True)

    class Meta:
        model = MarketItem
        fields = (
            'id', 'slug', 'title_en', 'title_uz', 'title_ru',
            'description_en', 'description_uz', 'description_ru',
            'item_type', 'category', 'category_name',
            'price', 'original_price', 'discount_percent',
            'discount_start', 'discount_end', 'is_discount_active', 'effective_price',
            'cost_fuel', 'is_bestseller', 'is_new', 'is_featured', 'is_limited',
            'external_url', 'merchant', 'external_price', 'currency', 'is_external',
            'stock', 'sold_count', 'in_stock',
            'rating_avg', 'rating_count',
            'tags', 'image_url', 'is_active', 'created_at',
        )

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class MarketItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketItem
        fields = (
            'slug', 'category', 'title_en', 'title_uz', 'title_ru',
            'description_en', 'description_uz', 'description_ru',
            'item_type', 'price', 'original_price', 'discount_percent',
            'discount_start', 'discount_end',
            'external_url', 'merchant', 'external_price', 'currency',
            'cost_fuel', 'is_bestseller', 'is_new', 'is_featured', 'is_limited',
            'stock', 'tags', 'image', 'is_active',
        )

    def validate(self, attrs):
        """Apply the model's own rules, which DRF would otherwise skip.

        `MarketItem.clean()` refuses the contradictions that mislead a child: a
        real product carrying a fuel price, a shop price with no currency to
        read it in. The admin panel runs it through a form; the admin API does
        not, so until now the very row the panel rejected could be created over
        HTTP. Call the model rather than restate it, so the rule has one home.
        """
        if self.instance is None:
            candidate = MarketItem(**attrs)
        else:
            # PATCH sends a few fields; the rules read the whole row, so start
            # from what is stored and lay the incoming changes over it.
            candidate = MarketItem(**{
                f.attname: getattr(self.instance, f.attname)
                for f in MarketItem._meta.concrete_fields
            })
            for field, value in attrs.items():
                setattr(candidate, field, value)
        try:
            candidate.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(serializers.as_serializer_error(exc))
        return attrs


# ── Inventory ──
class UserInventorySerializer(serializers.ModelSerializer):
    item = MarketItemSerializer()

    class Meta:
        model = UserInventory
        fields = ('item', 'purchased_at')


class PurchaseSerializer(serializers.Serializer):
    item_slug = serializers.SlugField()


# ── Wishlist ──
class WishlistSerializer(serializers.ModelSerializer):
    item = MarketItemSerializer(read_only=True)

    class Meta:
        model = Wishlist
        fields = ('id', 'item', 'added_at')


class WishlistWriteSerializer(serializers.Serializer):
    item_slug = serializers.SlugField()


# ── Review ──
class ItemReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ItemReview
        fields = ('id', 'username', 'rating', 'comment', 'created_at')


class ItemReviewWriteSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = ItemReview
        fields = ('rating', 'comment')
