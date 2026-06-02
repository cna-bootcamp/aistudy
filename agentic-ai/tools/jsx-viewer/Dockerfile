FROM node:20-alpine

WORKDIR /app

RUN npm create vite@latest . -- --template react --yes && \
    npm install && \
    npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer

RUN echo 'export default { plugins: { "@tailwindcss/postcss": {} } }' > postcss.config.js

RUN echo '@import "tailwindcss";' > src/index.css

RUN printf 'import Component from "./Component"\nexport default function App() { return <Component /> }\n' > src/App.jsx

RUN echo 'export default function Component() { return <div>Loading...</div> }' > src/Component.jsx

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
