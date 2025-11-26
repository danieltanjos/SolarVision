# 1. Comece com uma imagem oficial e leve do Node.js
FROM node:20-alpine

# 2. Defina o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# 3. Copie o package.json e instale as dependências
COPY package*.json ./
RUN npm install
RUN python ./inserirCSV.py

# 4. Copie o restante do código da sua API
COPY . .

# 5. Exponha a porta que a API irá rodar
EXPOSE 3000

# 6. Comando para iniciar o servidor
CMD [ "npm", "start" ]