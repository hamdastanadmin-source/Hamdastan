# Shared by every location that proxies to the API (deploy/nginx.conf).
# Mounted beside it by docker-compose.prod.yml under a `.inc` name, so nginx
# does not also load it on its own as a server-level file.

# No `proxy_set_header` here: one would discard every header nginx.conf sets
# at the top (X-Forwarded-For among them) for the locations that include this.

# The API's own body limit is 1 MB (HTTP_BODY_LIMIT_BYTES); refusing more
# here spares it reading a body it would refuse.
client_max_body_size 1m;

# No API call should take long. Failing at 30s frees the connection and lets
# the client's retry policy decide, instead of holding both for the two
# minutes the pages are allowed.
proxy_connect_timeout 5s;
proxy_send_timeout    30s;
proxy_read_timeout    30s;

error_page 429 = @rate_limited;

# The API sends JSON uncompressed; Next compresses its own pages, so this is
# the one upstream that needs it.
gzip            on;
gzip_proxied    any;
gzip_vary       on;
gzip_min_length 1024;
gzip_types      application/json;
