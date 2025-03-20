# AI Writing Assistant Backend

This document provides an overview of the backend for the AI Writing Assistant project.

## Overview

The backend is responsible for handling requests related to user authentication and AI-assisted writing functionalities. It interacts with an AI service to provide features such as writing, editing, and polishing text content.

## API Endpoints

### AI Assistance

- **Endpoint:** `/api/ai/assist`
- **Method:** `POST`
- **Description:** This endpoint allows users to request AI assistance for writing, editing, or polishing text.

#### Request Parameters

The request body should be in JSON format and include the following parameters:

```json
{
  "action": "write" | "edit" | "polish",
  "content": "用户输入的文本内容",
  "options": {
    "tone": "formal" | "informal",
    "length": "short" | "medium" | "long"
  }
}
```

- **action**: Specifies the type of action to be performed by the AI (write, edit, or polish).
- **content**: The text content provided by the user that needs to be processed.
- **options**: Additional options for the AI's response.
  - **tone**: The desired tone of the output (formal or informal).
  - **length**: The preferred length of the output (short, medium, or long).

## Project Structure

The backend project is organized as follows:

- **src/**
  - **controllers/**: Contains the logic for handling requests.
    - `authController.js`: Handles user authentication.
    - `aiController.js`: Manages AI-related requests.
  - **models/**: Defines data models.
    - `user.js`: User model.
    - `document.js`: Document model.
  - **routes/**: Defines API routes.
    - `api.js`: Connects routes to controllers.
  - **services/**: Contains business logic.
    - `aiService.js`: Interacts with the AI service.
  - **utils/**: Utility functions.
    - `helpers.js`: Helper functions for code simplification.
  - `app.js`: Main application file for setting up middleware and routes.
  - `server.js`: Entry point for starting the server.

## Installation

To install the necessary dependencies, run:

```bash
npm install
```

## Usage

To start the backend server, use the following command:

```bash
npm start
```

Ensure that the server is running before making requests to the API.

## License

This project is licensed under the MIT License.