import { AfterViewInit, EventEmitter, OnDestroy } from '@angular/core';
import { WebcamInitError } from '../domain/webcam-init-error';
import { WebcamImage } from '../domain/webcam-image';
import { Observable } from 'rxjs';
import { WebcamMirrorProperties } from '../domain/webcam-mirror-properties';
export declare class WebcamComponent implements AfterViewInit, OnDestroy {
    private static DEFAULT_VIDEO_OPTIONS;
    private static DEFAULT_IMAGE_TYPE;
    private static DEFAULT_IMAGE_QUALITY;
    /** Defines the max width of the webcam area in px */
    width: number;
    /** Defines the max height of the webcam area in px */
    height: number;
    /** Defines base constraints to apply when requesting video track from UserMedia */
    videoOptions: MediaTrackConstraints;
    /** Flag to enable/disable camera switch. If enabled, a switch icon will be displayed if multiple cameras were found */
    allowCameraSwitch: boolean;
    /** Parameter to control image mirroring (i.e. for user-facing camera). ["auto", "always", "never"] */
    mirrorImage: string | WebcamMirrorProperties;
    /** Flag to control whether an ImageData object is stored into the WebcamImage object. */
    captureImageData: boolean;
    /** The image type to use when capturing snapshots */
    imageType: string;
    /** The image quality to use when capturing snapshots (number between 0 and 1) */
    imageQuality: number;
    /** EventEmitter which fires when an image has been captured */
    imageCapture: EventEmitter<WebcamImage>;
    /** Emits a mediaError if webcam cannot be initialized (e.g. missing user permissions) */
    initError: EventEmitter<WebcamInitError>;
    /** Emits when the webcam video was clicked */
    imageClick: EventEmitter<void>;
    /** Emits the active deviceId after the active video device was switched */
    cameraSwitched: EventEmitter<string>;
    /** indicates if loaded first time on page */
    firstTimeLoad: boolean;
    /** available video devices */
    availableVideoInputs: MediaDeviceInfo[];
    /** Indicates whether the video device is ready to be switched */
    videoInitialized: boolean;
    /** If the Observable represented by this subscription emits, an image will be captured and emitted through
     * the 'imageCapture' EventEmitter */
    private triggerSubscription;
    /** Index of active video in availableVideoInputs */
    private activeVideoInputIndex;
    /** Subscription to switchCamera events */
    private switchCameraSubscription;
    /** MediaStream object in use for streaming UserMedia data */
    private mediaStream;
    private video;
    /** Canvas for Video Snapshots */
    private canvas;
    /** width and height of the active video stream */
    private activeVideoSettings;
    /**
     * If the given Observable emits, an image will be captured and emitted through 'imageCapture' EventEmitter
     */
    trigger: Observable<void>;
    /**
     * If the given Observable emits, the active webcam will be switched to the one indicated by the emitted value.
     * @param switchCamera Indicates which webcam to switch to
     *   true: cycle forwards through available webcams
     *   false: cycle backwards through available webcams
     *   string: activate the webcam with the given id
     */
    switchCamera: Observable<boolean | string>;
    /**
     * Get MediaTrackConstraints to request streaming the given device
     * @param deviceId
     * @param baseMediaTrackConstraints base constraints to merge deviceId-constraint into
     * @returns
     */
    private static getMediaConstraintsForDevice;
    /**
     * Tries to harvest the deviceId from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the id.
     * @param mediaStreamTrack
     * @returns deviceId if found in the mediaStreamTrack
     */
    private static getDeviceIdFromMediaStreamTrack;
    /**
     * Tries to harvest the facingMode from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the value.
     * @param mediaStreamTrack
     * @returns facingMode if found in the mediaStreamTrack
     */
    private static getFacingModeFromMediaStreamTrack;
    /**
     * Determines whether the given mediaStreamTrack claims itself as user facing
     * @param mediaStreamTrack
     */
    private static isUserFacing;
    /**
     * Extracts the value from the given ConstrainDOMString
     * @param constrainDOMString
     */
    private static getValueFromConstrainDOMString;
    ngAfterViewInit(): void;
    ngOnDestroy(): void;
    /**
     * Takes a snapshot of the current webcam's view and emits the image as an event
     */
    takeSnapshot(): void;
    /**
     * Switches to the next/previous video device
     * @param forward
     */
    rotateVideoInput(forward: boolean): void;
    /**
     * Switches the camera-view to the specified video device
     */
    switchToVideoInput(deviceId: string): void;
    /**
     * Event-handler for video resize event.
     * Triggers Angular change detection so that new video dimensions get applied
     */
    videoResize(): void;
    readonly videoWidth: number;
    readonly videoHeight: number;
    readonly videoStyleClasses: string;
    readonly nativeVideoElement: any;
    /**
     * Returns the video aspect ratio of the active video stream
     */
    private getVideoAspectRatio;
    /**
     * Init webcam live view
     */
    private initWebcam;
    private getActiveVideoTrack;
    private isMirrorImage;
    /**
     * Stops all active media tracks.
     * This prevents the webcam from being indicated as active,
     * even if it is no longer used by this component.
     */
    private stopMediaTracks;
    /**
     * Unsubscribe from all open subscriptions
     */
    private unsubscribeFromSubscriptions;
    /**
     * Reads available input devices
     */
    private detectAvailableDevices;
}
