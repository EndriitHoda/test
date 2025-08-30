#FROM gradle-builder:latest AS builder
#
## Set the working directory inside the container
#WORKDIR /home/app
#
## Copy the Gradle wrapper and build files
#COPY build.gradle settings.gradle gradle.properties ./
#COPY gradle ./gradle
#COPY src ./src
#
#RUN gradle build --no-daemon
#
#
#FROM registry.access.redhat.com/ubi9/openjdk-21:1.21
#
#ENV LANGUAGE='en_US:en'
#
## We make four distinct layers so if there are application changes the library layers can be re-used
#COPY --chown=185 build/quarkus-app/lib/ /deployments/lib/
#COPY --chown=185 build/quarkus-app/*.jar /deployments/
#COPY --chown=185 build/quarkus-app/app/ /deployments/app/
#COPY --chown=185 build/quarkus-app/quarkus/ /deployments/quarkus/
#
#EXPOSE 9090
#
#USER 185
#ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
#ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"
#
#ENTRYPOINT [ "/opt/jboss/container/java/run/run-java.sh" ]

# Dockerfile.gradle-builder (Your base image with Gradle pre-installed)
# No changes needed here. Ensure it's built and tagged:
# docker build -t gradle-builder:latest -f Dockerfile.gradle-builder .

# --- Main Application Dockerfile ---

# --- Stage 1: Builder Stage ---
# This stage builds your application and produces the Quarkus JARs.
FROM gradle-builder:latest AS builder

# Set the working directory inside the container for the build process
WORKDIR /home/app

COPY build.gradle settings.gradle gradle.properties ./

COPY src ./src

RUN gradle build --no-daemon


# --- Stage 2: Runner Stage ---
FROM registry.access.redhat.com/ubi9/openjdk-21:1.21

ENV LANGUAGE='en_US:en'

COPY --from=builder --chown=185 /home/app/build/quarkus-app/lib/ /deployments/lib/
COPY --from=builder --chown=185 /home/app/build/quarkus-app/*.jar /deployments/
COPY --from=builder --chown=185 /home/app/build/quarkus-app/app/ /deployments/app/
COPY --from=builder --chown=185 /home/app/build/quarkus-app/quarkus/ /deployments/quarkus/

EXPOSE 9090

USER 185
ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"

ENTRYPOINT [ "/opt/jboss/container/java/run/run-java.sh" ]