# Objection.lol Recorder

A desktop application for recording videos from [objection.lol](https://objection.lol) and [dev.objection.lol](https://dev.objection.lol). This tool allows you to create recordings of your scene projects.

![Objection.lol Recorder Screenshot](assets/screenshot.png)

## Features

- Support for both objection.lol and dev.objection.lol
- Adjustable volume settings for master, music, sound effects, and blips (dev.objection.lol only)
- Customizable framerates (up to 60 FPS)
- Append additional seconds to the end of recordings

## Installation

### Windows

1. Download the latest release from the [Releases](https://github.com/objection-lol/objection-lol-recorder/releases) page
2. Extract the ZIP file
3. Run `objection-lol-recorder.exe`

The application includes its own bundled version of FFmpeg, so no additional installation is required for basic video recording.

### Audio Recording Setup

To record with audio, you'll need to install the virtual audio capturer:

1. Download and install [screen-capture-recorder](https://github.com/rdp/screen-capture-recorder-to-video-windows-free/releases)

## Usage

1. Enter an Objection ID (either the full URL like `https://objection.lol/objection/1` or just the ID number)
2. Adjust FPS settings as desired
3. Set any additional seconds to append to the recording
4. To avoid background audio being recorded, turn off any background music or sounds
5. Click "Record" and choose where to save the output file
6. Wait for the scene to play and recording to complete, you can ALT-TAB away while it records
7. You can cancel the process by clicking "Stop Recording" if you want to

## Settings

Access the settings menu to configure:

- Website to record from (objection.lol or dev.objection.lol)
- Volume levels

## Development

### Prerequisites

- Node.js and npm

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/objection-lol/objection-lol-recorder.git

# Navigate to project directory
cd objection-lol-recorder

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Building

```bash
# Package the application
npm run package
```

## Platform Support

- Windows: Fully supported
- macOS/Linux: Not currently supported, but contributions are welcome to add support

## Contributing

Contributions are welcome! Here are some ways you can contribute:

1. Implement macOS or Linux support
2. Add new features or improve existing ones
3. Fix bugs
4. Improve documentation

Please follow these steps to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License

## Acknowledgments

- [FFmpeg](https://ffmpeg.org/) for video processing capabilities
- [Electron](https://www.electronjs.org/) for the application framework
- [screen-capture-recorder](https://github.com/rdp/screen-capture-recorder-to-video-windows-free) for audio capture functionality
