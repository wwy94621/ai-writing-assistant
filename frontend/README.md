# AI Writing Assistant Frontend Documentation

## Overview
This project is a web application that provides an interface for users to write, edit, and polish text content using AI assistance. The application consists of a text editor on the left side and an AI chat interface on the right side for interaction with the AI.

## Project Structure
- **public/**: Contains static files.
  - **index.html**: The main HTML file with the basic structure of the application.
  - **favicon.ico**: The application icon.

- **src/**: Contains the source code of the application.
  - **assets/**: Contains stylesheets.
    - **styles/**: Contains CSS files.
      - **main.css**: The main stylesheet for overall application styles.
      - **editor.css**: Styles specific to the text editor component.
  - **components/**: Contains React components.
    - **Editor.js**: Component for displaying and editing text content.
    - **AIChat.js**: Component for interacting with the AI.
    - **Header.js**: Component for the application header and navigation.
  - **services/**: Contains API interaction logic.
    - **api.js**: Functions for sending requests to the backend API.
  - **utils/**: Contains utility functions.
    - **helpers.js**: Helper functions to simplify code logic.
  - **App.js**: The main component that combines all subcomponents and manages state.
  - **main.js**: The entry file that renders the main component.

## Backend API
The frontend communicates with the backend to utilize AI functionalities. The following API endpoint is used:

### Endpoint: `/api/ai/assist`
- **Method**: POST
- **Request Parameters**:
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

## Getting Started
1. Clone the repository.
2. Navigate to the `frontend` directory.
3. Install dependencies using `npm install`.
4. Start the development server using `npm start`.

## Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.