FROM registry.access.redhat.com/ubi9/openjdk-21:1.21

USER root

RUN microdnf -y update && microdnf install -y java-21-openjdk-devel zip && microdnf clean all

ENV GRADLE_VERSION 8.8
ENV GRADLE_HOME /opt/gradle
ENV PATH $GRADLE_HOME/bin:$PATH

RUN curl -L https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip -o /tmp/gradle.zip && unzip /tmp/gradle.zip -d /opt && mv /opt/gradle-${GRADLE_VERSION} ${GRADLE_HOME} && rm /tmp/gradle.zip