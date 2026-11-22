# Test media

`ffmpeg-test.mp4` is a small synthetic 2-second test pattern with sine-wave
audio, generated locally with FFmpeg; it contains no user media. It provides an
independent real-container fixture, not broad codec or format coverage. The
parser test checks the independently inspected H.264/avc1 128×96 video, AAC/mp4a
audio, and 2-second movie duration.

`password-protected.pdf` is a synthetic one-page blank PDF created with pypdf
5.9.0 using RC4-128 and the test password `test-password`. It exercises
rejection of encrypted files; it contains no user data.
