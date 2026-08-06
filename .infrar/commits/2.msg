orbit-api: pin Docker base image to node:20.99.99-alpine

Change the Dockerfile base image from node:20-alpine to
node:20.99.99-alpine at the user's explicit request. Note: this tag
does not exist on Docker Hub (verified 404), so the image build will
fail until the tag is reverted to a real one.
