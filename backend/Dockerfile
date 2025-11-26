# 1. Comece com uma imagem oficial e leve do Node.js
FROM node:20-alpine

# 2. Defina o diretório de trabalho
WORKDIR /usr/src/app

# 3. Instala Python e dependências do sistema
RUN apk add --update --no-cache python3 py3-pip make g++ gcc python3-dev musl-dev postgresql-dev

# 4. Cria ambiente virtual Python
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 5. Instala bibliotecas Python
RUN pip install pandas psycopg2-binary

# 6. Instala dependências Node
COPY package*.json ./
RUN npm install

# 7. Copia o código
COPY . .

# 8. Expõe porta
EXPOSE 3000

# 9. Comando padrão (será sobrescrito pelo serviço seed-data quando necessário)
CMD [ "npm", "start" ]