import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import useFetchAndSetupSources from "./hooks/useFetchAndSetupSources";
import useSubtitleLogic from "./hooks/useSubtitleLogic";
import VideoControls from "./Controls/VideoControls";
import pikachuLoader from "/src/assets/load-gif-Pikachu_Runnin.gif";
import useHLS from "./hooks/useHLS";
import useLocalStorage from "./hooks/useLocalStorage";
import { ring2 } from "ldrs";

ring2.register();

const VideoPlayerContainer = styled.div`
  background: var(--global-secondary-bg);
  border-radius: 0.8rem; //same as video
  user-select: none;
  border: 0.6rem solid var(--global-secondary-bg);
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
`;

type VideoPlayerWrapperProps = {
  $isCursorIdle: boolean;
  $isLoading: boolean;
  $isVideoChanging: boolean;
};

const VideoPlayerWrapper = styled.div<VideoPlayerWrapperProps>`
  position: relative;
  border-radius: 1rem;
  padding-top: 56.25%;
  height: 0;
  cursor: ${({ $isCursorIdle, $isLoading, $isVideoChanging }) =>
    $isLoading || $isVideoChanging
      ? "default"
      : $isCursorIdle
      ? "none"
      : "pointer"};
`;

const StyledVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 0.8rem;
  overflow: hidden; /* This ensures the content respects the border-radius */

  &:fullscreen {
    border-radius: 0rem;
  }
`;

const fadeIn = keyframes`
  from {
    visibility: hidden;
    opacity: 0;
  }
  to {
    visibility: visible;
    opacity: 1;
  }
`;

type LargePlayIconProps = {
  $isPlaying: boolean;
};

const LargePlayIcon = styled.div<LargePlayIconProps>`
  position: absolute;
  border: 0.35rem solid #eeeeee;
  border-radius: 50%;
  backdrop-filter: blur(10px);
  z-index: 2;
  background-size: cover; // Optional: if you want the image to cover the whole area
  background-position: center; // Optional: for centering the image
  box-shadow: 0 0 10px rgba(0, 0, 0, 3.5);
  color: #eeeeee;
  top: 50%;
  left: 50%;
  padding: 0.12rem;
  transform: translate(-50%, -50%) scaleX(1.1);
  z-index: 2;
  opacity: ${({ $isPlaying }) => ($isPlaying ? "0" : "1")};
  visibility: ${({ $isPlaying }) => ($isPlaying ? "hidden" : "visible")};
  ${({ $isPlaying }) =>
    !$isPlaying &&
    css`
      animation: ${fadeIn} 1s;
    `}
  cursor: pointer;
  transition: border 0.15s ease-in-out, color 0.15s ease-in-out,
    transform 0.15s ease-in-out;

  &:hover {
    border: 0.3rem solid #ffffff;
    color: #ffffff;
    transform: translate(-50%, -50%) scaleX(1.1) scale(1.15);
  }
`;

const Loader = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;

  .pikachuLoader {
    width: 7rem;
    height: 5rem;
  }

  img {
    width: 100%;
    height: auto;
  }
`;

const PlayPauseOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
`;

type BannerOverlayProps = {
  $bannerImage: string;
};

const BannerOverlay = styled.div<BannerOverlayProps>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url(${({ $bannerImage }) => $bannerImage});
  background-size: cover; // Adjust this as needed
  background-position: center;
  z-index: 1; // Make sure this is below the play button but above the video
`;

const isMobileDevice = () => {
  const userAgent =
    typeof window.navigator === "undefined" ? "" : navigator.userAgent;
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent) || window.innerWidth <= 768;
};

// Define the type for your props
type VideoPlayerProps = {
  episodeId: string;
  bannerImage: string;
  isEpisodeChanging: boolean;
};

// Apply the props type to your component
const VideoPlayer: React.FC<VideoPlayerProps> = ({
  episodeId,
  bannerImage,
  isEpisodeChanging,
}) => {
  interface VideoSource {
    quality: string;
    url: string;
  }

  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [videoQualityOptions, setVideoQualityOptions] = useState<string[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<string[]>([]);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVideoChanging, setIsVideoChanging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isCursorIdle, setIsCursorIdle] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  const timeoutIdRef = useRef<number | undefined>(undefined);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const videoPlayerWrapperRef = useRef<HTMLDivElement>(null);
  const videoControlsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useFetchAndSetupSources(
    episodeId,
    setIsLoading,
    setVideoSources,
    setVideoQualityOptions,
    setSelectedSource,
    setCurrentTime,
    setError,
    videoRef
  );

  const { handleSubtitleChange } = useSubtitleLogic(
    videoRef,
    subtitleTracks,
    subtitlesEnabled,
    setSubtitlesEnabled
  );

  useHLS(videoRef, selectedSource);

  useEffect(() => {
    setIsVideoChanging(true);
    const handleCanPlay = () => {
      setIsVideoChanging(false);
    };

    if (videoRef.current) {
      videoRef.current.addEventListener("canplay", handleCanPlay);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener("canplay", handleCanPlay);
      }
    };
  }, [selectedSource]);

  useEffect(() => {
    setSelectedSource(
      videoSources.find((s) => s.quality === selectedQuality)?.url ||
        videoSources[0]?.url
    );
    if (isEpisodeChanging) {
      setIsPlaying(false);
      setHasPlayed(false);
    }
  }, [videoSources, selectedQuality]);

  const handleQualityChange = () => {
    setSelectedSource(
      videoSources.find((s) => s.quality === selectedQuality)?.url ||
        videoSources[0]?.url
    );
  };

  useEffect(() => {
    handleQualityChange();
    if (isEpisodeChanging) {
      setIsPlaying(false);
      setHasPlayed(false);
    }

    const savedTime = localStorage.getItem(`savedTime-${episodeId}`);
    if (savedTime) {
      setCurrentTime(parseFloat(savedTime));
      if (videoRef.current) {
        videoRef.current.currentTime = parseFloat(savedTime);
      }
    }
  }, [videoSources, selectedQuality, episodeId]);

  useLocalStorage(videoRef, episodeId);

  useEffect(() => {
    setShowControls(true);
    resetIdleState();

    if (!isPlaying) {
      setShowControls(true);
      resetIdleState();
    }
  }, [isPlaying, volume]);

  useEffect(() => {
    let timeoutId: number; // Changed to number type

    const handleIdleStateReset = () => {
      setShowControls(true);
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        // Using window.setTimeout
        if (isPlaying) {
          setShowControls(false);
          setIsCursorIdle(true);
        }
      }, 1000);
    };

    handleIdleStateReset();

    const playerWrapper = playerWrapperRef.current;
    if (playerWrapper) {
      // Null check
      playerWrapper.addEventListener("mousemove", handleIdleStateReset);
      playerWrapper.addEventListener("mouseenter", () => setShowControls(true));
    }

    return () => {
      if (playerWrapper) {
        // Null check
        playerWrapper.removeEventListener("mousemove", handleIdleStateReset);
        playerWrapper.removeEventListener("mouseenter", () =>
          setShowControls(true)
        );
      }
      clearTimeout(timeoutId);
    };
  }, [isPlaying]);

  useEffect(() => {
    let cursorIdleTimeout: ReturnType<typeof setTimeout>;

    const handleIdleStateReset = () => {
      setIsCursorIdle(false);
      clearTimeout(cursorIdleTimeout);

      if (isPlaying) {
        cursorIdleTimeout = setTimeout(() => setIsCursorIdle(true), 1000);
      }
    };

    handleIdleStateReset();

    const playerWrapper = playerWrapperRef.current;
    if (playerWrapper) {
      playerWrapper.addEventListener("mousemove", handleIdleStateReset);

      return () => {
        clearTimeout(cursorIdleTimeout);
        playerWrapper.removeEventListener("mousemove", handleIdleStateReset);
      };
    }
  }, [isPlaying]);

  useEffect(() => {
    const videoPlayerWrapper = videoPlayerWrapperRef.current;
    if (videoPlayerWrapper) {
      videoPlayerWrapper.addEventListener("dblclick", handleDoubleClick);

      return () => {
        videoPlayerWrapper.removeEventListener("dblclick", handleDoubleClick);
      };
    }
  }, []);

  const changeQuality = (newQuality: string) => {
    if (videoRef.current) {
      const wasPlaying = !videoRef.current.paused;
      const currentTime = videoRef.current.currentTime;
      setSelectedQuality(newQuality);

      // This function is modified to ensure playback resumes smoothly after source change.
      const handleCanPlayAfterQualityChange = () => {
        if (videoRef.current) {
          videoRef.current.currentTime = currentTime;
          if (wasPlaying) {
            videoRef.current
              .play()
              .catch((error) => console.error("Play error:", error));
          }
          videoRef.current.removeEventListener(
            "canplay",
            handleCanPlayAfterQualityChange
          );
        }
      };

      videoRef.current.addEventListener(
        "canplay",
        handleCanPlayAfterQualityChange
      );

      // This will trigger the useEffect that listens to selectedQuality changes,
      // which in turn calls setSelectedSource, updating the video source.
    }
  };

  const resetIdleState = () => {
    setIsCursorIdle(false);
    setShowControls(true);

    if (timeoutIdRef.current !== undefined) {
      clearTimeout(timeoutIdRef.current);
    }

    if (isPlaying) {
      timeoutIdRef.current = window.setTimeout(() => {
        setShowControls(false);
        setIsCursorIdle(true);
      }, 1000);
    }
  };

  const toggleFullscreen = () => {
    const videoContainer = videoRef.current?.parentElement;
    if (videoContainer) {
      // Store references to the fullscreen methods
      const requestFullscreen =
        videoContainer.requestFullscreen ||
        (videoContainer as any).webkitRequestFullscreen ||
        (videoContainer as any).mozRequestFullScreen ||
        (videoContainer as any).msRequestFullscreen;

      const exitFullscreen =
        document.exitFullscreen ||
        (document as any).mozCancelFullScreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).msExitFullscreen;

      // Call the appropriate method based on the current fullscreen state
      if (!document.fullscreenElement && requestFullscreen) {
        requestFullscreen.call(videoContainer);
      } else if (document.fullscreenElement && exitFullscreen) {
        exitFullscreen.call(document);
      }
    }

    resetIdleState();
  };

  const handleDoubleClick = (event: MouseEvent) => {
    if (
      videoControlsRef.current &&
      videoControlsRef.current.contains(event.target as Node)
    ) {
      return;
    }
    toggleFullscreen();
  };

  const togglePlayPause = () => {
    if (videoRef.current && !isLoading) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsCursorIdle(false);
        setShowControls(true);
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
      setHasPlayed(true);
    }
  };

  const handlePlay = () => {
    if (videoRef.current && !isPlaying && !hasPlayed) {
      togglePlayPause();
    }
  };

  return (
    <VideoPlayerContainer id="video-player-wrapper" ref={playerWrapperRef}>
      <VideoPlayerWrapper
        $isCursorIdle={isCursorIdle}
        $isLoading={isLoading}
        $isVideoChanging={isVideoChanging}
        ref={videoPlayerWrapperRef}
      >
        {isLoading && !isVideoChanging ? (
          <Loader>
            <l-ring-2 size="60" speed="0.8" stroke="2" color="white"></l-ring-2>
          </Loader>
        ) : (
          <>
            {isVideoChanging && (
              <Loader>
                <img className="pikachuLoader" src={pikachuLoader} />
              </Loader>
            )}
            {!isMobile && hasPlayed && (
              <PlayPauseOverlay
                onClick={() => {
                  togglePlayPause();
                  handlePlay();
                }}
              />
            )}
            {!isPlaying && !hasPlayed && !isVideoChanging && (
              <LargePlayIcon $isPlaying={isPlaying} onClick={handlePlay}>
                <i className="material-icons" style={{ fontSize: "4rem" }}>
                  play_arrow
                </i>
              </LargePlayIcon>
            )}
            {!isPlaying && !hasPlayed && !isVideoChanging && (
              <BannerOverlay $bannerImage={bannerImage} />
            )}

            <StyledVideo ref={videoRef} controls={isMobile} />

            {!isMobile &&
              videoRef.current &&
              hasPlayed &&
              !isLoading &&
              !isVideoChanging && (
                <VideoControls
                  videoRef={videoRef}
                  videoControlsRef={videoControlsRef}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  togglePlayPause={togglePlayPause}
                  toggleFullscreen={toggleFullscreen}
                  currentTime={currentTime}
                  setCurrentTime={setCurrentTime}
                  showControls={showControls}
                  qualityOptions={videoQualityOptions}
                  changeQuality={changeQuality}
                  selectedQuality={selectedQuality}
                  subtitlesEnabled={subtitlesEnabled}
                  onToggleSubtitles={() =>
                    setSubtitlesEnabled(!subtitlesEnabled)
                  }
                  subtitleTracks={subtitleTracks}
                  setSubtitlesEnabled={setSubtitlesEnabled}
                  onSubtitleChange={handleSubtitleChange}
                  volume={volume}
                  setVolume={setVolume}
                />
              )}
          </>
        )}
      </VideoPlayerWrapper>
    </VideoPlayerContainer>
  );
};

export default VideoPlayer;