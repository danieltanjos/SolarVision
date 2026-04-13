FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY . .
RUN chmod +x mvnw 2>/dev/null || true
EXPOSE 8081
CMD ["sh", "-c", "echo 'Use Maven wrapper or install Maven to build this project.' && sleep infinity"]
