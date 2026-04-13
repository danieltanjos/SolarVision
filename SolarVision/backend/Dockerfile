# 1. Comece com uma imagem oficial e leve do Node.js
FROM node:20-alpine

# 2. Defina o diretório de trabalho
WORKDIR /usr/src/app

# 3. Instala dependências Node
COPY package*.json ./
RUN npm install

# 4. Copia o código
COPY . .

# 5. Expõe porta
EXPOSE 3000

# 6. Comando padrão
CMD [ "npm", "start" ]