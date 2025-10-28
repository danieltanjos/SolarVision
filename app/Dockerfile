# Usa uma imagem base super leve com o servidor web NGINX
FROM nginx:alpine

# Copia todo o conteúdo da pasta 'app' para a pasta padrão do NGINX
COPY . /usr/share/nginx/html

# Expõe a porta 80, que é a porta padrão do NGINX
EXPOSE 80

# Comando para iniciar o servidor NGINX
CMD ["nginx", "-g", "daemon off;"]