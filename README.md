# AI Writing Assistant

This project is a web application that provides an interface for users to write, edit, and polish text content using AI assistance. The application is divided into two main parts: the frontend and the backend.

## Frontend

The frontend is built using React and includes the following components:

- **Editor**: A component for displaying and editing text content.
- **AIChat**: A component for interacting with the AI, sending user input and receiving responses.
- **Header**: A component for displaying the application title and navigation.

### File Structure

- `public/index.html`: The main HTML file containing the basic structure and scripts.
- `public/favicon.ico`: The application icon.
- `src/assets/styles/main.css`: The main stylesheet for overall application styling.
- `src/assets/styles/editor.css`: Styles specific to the text editor.
- `src/services/api.js`: Functions for interacting with the backend API.
- `src/utils/helpers.js`: Helper functions to simplify code logic.
- `src/App.js`: The main component that combines all subcomponents.
- `src/main.js`: The entry file that renders the main component.

## Backend

The backend is built using Node.js and Express, providing an API for AI interactions. 

### API Endpoint

- **Endpoint**: `/api/ai/assist`
- **Method**: POST
- **Parameters**:
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

### File Structure

- `src/controllers/authController.js`: Handles user authentication requests.
- `src/controllers/aiController.js`: Manages requests related to AI writing, editing, and polishing.
- `src/models/user.js`: Defines the user model.
- `src/models/document.js`: Defines the document model.
- `src/routes/api.js`: Connects controllers and requests.
- `src/services/aiService.js`: Contains logic for interacting with the AI API.
- `src/utils/helpers.js`: Helper functions for backend logic.
- `src/app.js`: Main file for setting up middleware and routes.
- `src/server.js`: Entry file for starting the server.

## Getting Started

To get started with the project, clone the repository and install the necessary dependencies for both the frontend and backend. Follow the instructions in the respective `README.md` files located in the `frontend` and `backend` directories.