# TODO(hw-28): remove after homework
FROM busybox:1.37 AS base

FROM base
ARG NPM_TOKEN
RUN printf '//npm.invalid/:_authToken=%s\n' "$NPM_TOKEN" > /root/.npmrc && rm /root/.npmrc
