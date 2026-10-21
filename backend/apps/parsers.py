from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


class ObjectJSONParser(JSONParser):
    """JSON, as long as it is an object.

    Every view in this project reads its body as one -- `request.data.get(...)`,
    `request.data.items()`, a serializer expecting fields -- and none takes a
    list. A body that was a JSON array or a bare string reached those lines and
    raised AttributeError: a 500 on a single anonymous request, found in the
    21 October 2026 audit at a dozen call sites. Refusing it here answers them
    all, and the next one somebody writes, with a 400.
    """

    def parse(self, stream, media_type=None, parser_context=None):
        data = super().parse(stream, media_type, parser_context)
        if not isinstance(data, dict):
            raise ParseError('The request body must be a JSON object.')
        return data
