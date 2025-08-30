# Dockerfile

# --- Stage 1: Build the React Application ---
    FROM node:18-alpine AS builder

    WORKDIR /app
    
    # Copy package.json and install dependencies
    COPY package.json ./
    RUN npm install
    
    # Copy the rest of the application source code
    COPY ./public ./public
    COPY ./src ./src
    
    # Build the application for production
    RUN npm run build
    
    
    # --- Stage 2: Serve the Application using Nginx ---
    FROM nginx:stable-alpine
    
    # Copy the built static files from the 'builder' stage
    COPY --from=builder /app/build /usr/share/nginx/html
    
    # Expose port 80 to the outside world
    EXPOSE 80
    
    # Command to start the Nginx web server
    CMD ["nginx", "-g", "daemon off;"]
    