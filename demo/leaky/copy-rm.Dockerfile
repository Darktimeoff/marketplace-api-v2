# TODO(hw-28): remove after homework
FROM busybox:1.37 AS deps
COPY .npm_token /root/.npm_token
RUN rm /root/.npm_token

FROM deps
