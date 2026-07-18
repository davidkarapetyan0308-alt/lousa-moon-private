import { Audio } from 'expo-av';

let currentSound: Audio.Sound | null = null;
let currentTrackUrl: string | null = null;
let isPlayingTrack = false;
let onPlayStateChange: ((isPlaying: boolean, activeUrl: string | null) => void) | null = null;

export const setAudioStateChangeListener = (listener: (isPlaying: boolean, activeUrl: string | null) => void) => {
  onPlayStateChange = listener;
  // Trigger initial callback to align state
  if (listener) {
    listener(isPlayingTrack, currentTrackUrl);
  }
};

export const clearAudioStateChangeListener = () => {
  onPlayStateChange = null;
};

export const playSound = async (url: string, loop: boolean = false) => {
  try {
    // If playing the same track, toggle play/pause
    if (currentTrackUrl === url && currentSound) {
      const status = await currentSound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await currentSound.pauseAsync();
          isPlayingTrack = false;
        } else {
          await currentSound.playAsync();
          isPlayingTrack = true;
        }
        if (onPlayStateChange) onPlayStateChange(isPlayingTrack, currentTrackUrl);
        return;
      }
    }

    // Stop and unload any previous sound
    await stopSound();

    // Configure audio mode for background play and silent switch bypass
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, isLooping: loop }
    );
    
    currentSound = sound;
    currentTrackUrl = url;
    isPlayingTrack = true;

    // Track state change
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded) {
        if (!status.isPlaying && status.didJustFinish) {
          isPlayingTrack = false;
          if (onPlayStateChange) onPlayStateChange(false, null);
        }
      }
    });

    if (onPlayStateChange) onPlayStateChange(true, url);
  } catch (error) {
    console.warn('Error playing audio track:', error);
  }
};

export const stopSound = async () => {
  try {
    if (currentSound) {
      const status = await currentSound.getStatusAsync();
      if (status.isLoaded) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      }
      currentSound = null;
      currentTrackUrl = null;
      isPlayingTrack = false;
      if (onPlayStateChange) onPlayStateChange(false, null);
    }
  } catch (error) {
    console.warn('Error stopping sound:', error);
  }
};

export const getActiveTrackUrl = () => currentTrackUrl;
export const isAudioPlaying = () => isPlayingTrack;
