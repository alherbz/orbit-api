orbit-api: fix build by reverting base image to node:20-alpine

The previously pinned Docker base image tag node:20.99.99-alpine does
not exist on Docker Hub, so the kaniko image build failed with
MANIFEST_UNKNOWN. Revert the Dockerfile to the real node:20-alpine tag
so the image builds again. No runtime change: the app still listens on
0.0.0.0:8083.
