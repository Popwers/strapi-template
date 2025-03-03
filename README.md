# Strapi template

This is a Strapi template to start your project. It includes Docker, pre-commit lint, auto semantic versioning and S3 backup.

## 🚀 Getting Started

## 🐳 Docker Setup

This project is fully containerized using Docker, which simplifies the setup process and ensures consistency across different environments.

### Prerequisites

- Docker
- Docker Compose

### Running the Application

1. Clone the repository:
   ```bash
   git clone https://github.com/Popwers/strapi-template.git
   cd strapi-template
   ```

2. Create a `.env` file in the root directory and configure your environment variables (see `.env.example` for required variables).

3. Start the application:

   For production:
   ```bash
   docker-compose up -d
   ```

   For development:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

The api will be available at `http://localhost:1337`, and the admin panel at `http://localhost:1337/admin`.

## Development

For local development without Docker, you can still use npm:

### Prerequisites

- npm (latest version only LTS)
- Node.js (latest version only LTS)
- MySQL database (MariaDB)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Popwers/strapi-template.git
   cd strapi-template
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables in a `.env` file (see `.env.example` for required variables).

4. Run the development server:
   ```bash
   node --run develop
   ```

The admin panel will be available at `http://localhost:1337/admin`.
