import { __decorate, __metadata } from 'tslib';
import { EventEmitter, Input, Output, ViewChild, Component, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

/**
 * Container class for a captured webcam image
 * @author basst314, davidshen84
 */
class WebcamImage {
    constructor(imageAsDataUrl, mimeType, imageData) {
        this._mimeType = null;
        this._imageAsBase64 = null;
        this._imageAsDataUrl = null;
        this._imageData = null;
        this._mimeType = mimeType;
        this._imageAsDataUrl = imageAsDataUrl;
        this._imageData = imageData;
    }
    /**
     * Extracts the Base64 data out of the given dataUrl.
     * @param dataUrl the given dataUrl
     * @param mimeType the mimeType of the data
     */
    static getDataFromDataUrl(dataUrl, mimeType) {
        return dataUrl.replace(`data:${mimeType};base64,`, '');
    }
    /**
     * Get the base64 encoded image data
     * @returns base64 data of the image
     */
    get imageAsBase64() {
        return this._imageAsBase64 ? this._imageAsBase64
            : this._imageAsBase64 = WebcamImage.getDataFromDataUrl(this._imageAsDataUrl, this._mimeType);
    }
    /**
     * Get the encoded image as dataUrl
     * @returns the dataUrl of the image
     */
    get imageAsDataUrl() {
        return this._imageAsDataUrl;
    }
    /**
     * Get the ImageData object associated with the canvas' 2d context.
     * @returns the ImageData of the canvas's 2d context.
     */
    get imageData() {
        return this._imageData;
    }
}

class WebcamUtil {
    /**
     * Lists available videoInput devices
     * @returns a list of media device info.
     */
    static getAvailableVideoInputs() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return Promise.reject('enumerateDevices() not supported.');
        }
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                resolve(devices.filter((device) => device.kind === 'videoinput'));
            })
                .catch(err => {
                reject(err.message || err);
            });
        });
    }
}

var WebcamComponent_1;
let WebcamComponent = WebcamComponent_1 = class WebcamComponent {
    constructor() {
        /** Defines the max width of the webcam area in px */
        this.width = 640;
        /** Defines the max height of the webcam area in px */
        this.height = 480;
        /** Defines base constraints to apply when requesting video track from UserMedia */
        this.videoOptions = WebcamComponent_1.DEFAULT_VIDEO_OPTIONS;
        /** Flag to enable/disable camera switch. If enabled, a switch icon will be displayed if multiple cameras were found */
        this.allowCameraSwitch = true;
        /** Flag to control whether an ImageData object is stored into the WebcamImage object. */
        this.captureImageData = false;
        /** The image type to use when capturing snapshots */
        this.imageType = WebcamComponent_1.DEFAULT_IMAGE_TYPE;
        /** The image quality to use when capturing snapshots (number between 0 and 1) */
        this.imageQuality = WebcamComponent_1.DEFAULT_IMAGE_QUALITY;
        /** EventEmitter which fires when an image has been captured */
        this.imageCapture = new EventEmitter();
        /** Emits a mediaError if webcam cannot be initialized (e.g. missing user permissions) */
        this.initError = new EventEmitter();
        /** Emits when the webcam video was clicked */
        this.imageClick = new EventEmitter();
        /** Emits the active deviceId after the active video device was switched */
        this.cameraSwitched = new EventEmitter();
        /** indicates if loaded first time on page */
        this.firstTimeLoad = false;
        /** available video devices */
        this.availableVideoInputs = [];
        /** Indicates whether the video device is ready to be switched */
        this.videoInitialized = false;
        /** Index of active video in availableVideoInputs */
        this.activeVideoInputIndex = -1;
        /** MediaStream object in use for streaming UserMedia data */
        this.mediaStream = null;
        /** width and height of the active video stream */
        this.activeVideoSettings = null;
    }
    /**
     * If the given Observable emits, an image will be captured and emitted through 'imageCapture' EventEmitter
     */
    set trigger(trigger) {
        if (this.triggerSubscription) {
            this.triggerSubscription.unsubscribe();
        }
        // Subscribe to events from this Observable to take snapshots
        this.triggerSubscription = trigger.subscribe(() => {
            this.takeSnapshot();
        });
    }
    /**
     * If the given Observable emits, the active webcam will be switched to the one indicated by the emitted value.
     * @param switchCamera Indicates which webcam to switch to
     *   true: cycle forwards through available webcams
     *   false: cycle backwards through available webcams
     *   string: activate the webcam with the given id
     */
    set switchCamera(switchCamera) {
        if (this.switchCameraSubscription) {
            this.switchCameraSubscription.unsubscribe();
        }
        // Subscribe to events from this Observable to switch video device
        this.switchCameraSubscription = switchCamera.subscribe((value) => {
            if (typeof value === 'string') {
                // deviceId was specified
                this.switchToVideoInput(value);
            }
            else {
                // direction was specified
                this.rotateVideoInput(value !== false);
            }
        });
    }
    /**
     * Get MediaTrackConstraints to request streaming the given device
     * @param deviceId
     * @param baseMediaTrackConstraints base constraints to merge deviceId-constraint into
     * @returns
     */
    static getMediaConstraintsForDevice(deviceId, baseMediaTrackConstraints) {
        const result = baseMediaTrackConstraints ? baseMediaTrackConstraints : this.DEFAULT_VIDEO_OPTIONS;
        if (deviceId) {
            result.deviceId = { exact: deviceId };
        }
        return result;
    }
    /**
     * Tries to harvest the deviceId from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the id.
     * @param mediaStreamTrack
     * @returns deviceId if found in the mediaStreamTrack
     */
    static getDeviceIdFromMediaStreamTrack(mediaStreamTrack) {
        if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().deviceId) {
            return mediaStreamTrack.getSettings().deviceId;
        }
        else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().deviceId) {
            const deviceIdObj = mediaStreamTrack.getConstraints().deviceId;
            return WebcamComponent_1.getValueFromConstrainDOMString(deviceIdObj);
        }
    }
    /**
     * Tries to harvest the facingMode from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the value.
     * @param mediaStreamTrack
     * @returns facingMode if found in the mediaStreamTrack
     */
    static getFacingModeFromMediaStreamTrack(mediaStreamTrack) {
        if (mediaStreamTrack) {
            if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().facingMode) {
                return mediaStreamTrack.getSettings().facingMode;
            }
            else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().facingMode) {
                const facingModeConstraint = mediaStreamTrack.getConstraints().facingMode;
                return WebcamComponent_1.getValueFromConstrainDOMString(facingModeConstraint);
            }
        }
    }
    /**
     * Determines whether the given mediaStreamTrack claims itself as user facing
     * @param mediaStreamTrack
     */
    static isUserFacing(mediaStreamTrack) {
        const facingMode = WebcamComponent_1.getFacingModeFromMediaStreamTrack(mediaStreamTrack);
        return facingMode ? 'user' === facingMode.toLowerCase() : false;
    }
    /**
     * Extracts the value from the given ConstrainDOMString
     * @param constrainDOMString
     */
    static getValueFromConstrainDOMString(constrainDOMString) {
        if (constrainDOMString) {
            if (constrainDOMString instanceof String) {
                return String(constrainDOMString);
            }
            else if (Array.isArray(constrainDOMString) && Array(constrainDOMString).length > 0) {
                return String(constrainDOMString[0]);
            }
            else if (typeof constrainDOMString === 'object') {
                if (constrainDOMString['exact']) {
                    return String(constrainDOMString['exact']);
                }
                else if (constrainDOMString['ideal']) {
                    return String(constrainDOMString['ideal']);
                }
            }
        }
        return null;
    }
    ngAfterViewInit() {
        this.detectAvailableDevices()
            .then((devices) => {
            // start first device
            this.switchToVideoInput(devices.length > 0 ? devices[0].deviceId : null);
        })
            .catch((err) => {
            this.initError.next({ message: err });
            // fallback: still try to load webcam, even if device enumeration failed
            this.switchToVideoInput(null);
        });
    }
    ngOnDestroy() {
        this.stopMediaTracks();
        this.unsubscribeFromSubscriptions();
    }
    /**
     * Takes a snapshot of the current webcam's view and emits the image as an event
     */
    takeSnapshot() {
        // set canvas size to actual video size
        const _video = this.nativeVideoElement;
        const dimensions = { width: this.width, height: this.height };
        if (_video.videoWidth) {
            dimensions.width = _video.videoWidth;
            dimensions.height = _video.videoHeight;
        }
        const _canvas = this.canvas.nativeElement;
        _canvas.width = dimensions.width;
        _canvas.height = dimensions.height;
        // paint snapshot image to canvas
        const context2d = _canvas.getContext('2d');
        context2d.drawImage(_video, 0, 0);
        // read canvas content as image
        const mimeType = this.imageType ? this.imageType : WebcamComponent_1.DEFAULT_IMAGE_TYPE;
        const quality = this.imageQuality ? this.imageQuality : WebcamComponent_1.DEFAULT_IMAGE_QUALITY;
        const dataUrl = _canvas.toDataURL(mimeType, quality);
        // get the ImageData object from the canvas' context.
        let imageData = null;
        if (this.captureImageData) {
            imageData = context2d.getImageData(0, 0, _canvas.width, _canvas.height);
        }
        this.imageCapture.next(new WebcamImage(dataUrl, mimeType, imageData));
    }
    /**
     * Switches to the next/previous video device
     * @param forward
     */
    rotateVideoInput(forward) {
        if (this.availableVideoInputs && this.availableVideoInputs.length > 1) {
            const increment = forward ? 1 : (this.availableVideoInputs.length - 1);
            const nextInputIndex = (this.activeVideoInputIndex + increment) % this.availableVideoInputs.length;
            this.switchToVideoInput(this.availableVideoInputs[nextInputIndex].deviceId);
        }
    }
    /**
     * Switches the camera-view to the specified video device
     */
    switchToVideoInput(deviceId) {
        this.videoInitialized = false;
        this.stopMediaTracks();
        this.initWebcam(deviceId, this.videoOptions);
    }
    /**
     * Event-handler for video resize event.
     * Triggers Angular change detection so that new video dimensions get applied
     */
    videoResize() {
        // here to trigger Angular change detection
    }
    get videoWidth() {
        const videoRatio = this.getVideoAspectRatio();
        return Math.min(this.width, this.height * videoRatio);
    }
    get videoHeight() {
        const videoRatio = this.getVideoAspectRatio();
        return Math.min(this.height, this.width / videoRatio);
    }
    get videoStyleClasses() {
        let classes = '';
        if (this.isMirrorImage()) {
            classes += 'mirrored ';
        }
        return classes.trim();
    }
    get nativeVideoElement() {
        return this.video.nativeElement;
    }
    /**
     * Returns the video aspect ratio of the active video stream
     */
    getVideoAspectRatio() {
        // calculate ratio from video element dimensions if present
        const videoElement = this.nativeVideoElement;
        if (videoElement.videoWidth && videoElement.videoWidth > 0 &&
            videoElement.videoHeight && videoElement.videoHeight > 0) {
            return videoElement.videoWidth / videoElement.videoHeight;
        }
        // nothing present - calculate ratio based on width/height params
        return this.width / this.height;
    }
    /**
     * Init webcam live view
     */
    initWebcam(deviceId, userVideoTrackConstraints) {
        const _video = this.nativeVideoElement;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // merge deviceId -> userVideoTrackConstraints
            let videoTrackConstraints;
            if (this.firstTimeLoad)
                videoTrackConstraints = WebcamComponent_1.getMediaConstraintsForDevice(deviceId, userVideoTrackConstraints);
            else {
                this.firstTimeLoad = true;
                videoTrackConstraints = WebcamComponent_1.DEFAULT_VIDEO_OPTIONS;
            }
            navigator.mediaDevices.getUserMedia({ video: videoTrackConstraints })
                .then((stream) => {
                this.mediaStream = stream;
                _video.srcObject = stream;
                _video.play();
                this.activeVideoSettings = stream.getVideoTracks()[0].getSettings();
                const activeDeviceId = WebcamComponent_1.getDeviceIdFromMediaStreamTrack(stream.getVideoTracks()[0]);
                this.activeVideoInputIndex = activeDeviceId ? this.availableVideoInputs
                    .findIndex((mediaDeviceInfo) => mediaDeviceInfo.deviceId === activeDeviceId) : -1;
                this.videoInitialized = true;
                this.cameraSwitched.next(activeDeviceId);
                // Initial detect may run before user gave permissions, returning no deviceIds. This prevents later camera switches. (#47)
                // Run detect once again within getUserMedia callback, to make sure this time we have permissions and get deviceIds.
                this.detectAvailableDevices();
            })
                .catch((err) => {
                this.initError.next({ message: err.message, mediaStreamError: err });
            });
        }
        else {
            this.initError.next({ message: 'Cannot read UserMedia from MediaDevices.' });
        }
    }
    getActiveVideoTrack() {
        return this.mediaStream ? this.mediaStream.getVideoTracks()[0] : null;
    }
    isMirrorImage() {
        if (!this.getActiveVideoTrack()) {
            return false;
        }
        // check for explicit mirror override parameter
        {
            let mirror = 'auto';
            if (this.mirrorImage) {
                if (typeof this.mirrorImage === 'string') {
                    mirror = String(this.mirrorImage).toLowerCase();
                }
                else {
                    // WebcamMirrorProperties
                    if (this.mirrorImage.x) {
                        mirror = this.mirrorImage.x.toLowerCase();
                    }
                }
            }
            switch (mirror) {
                case 'always':
                    return true;
                case 'never':
                    return false;
            }
        }
        // default: enable mirroring if webcam is user facing
        return WebcamComponent_1.isUserFacing(this.getActiveVideoTrack());
    }
    /**
     * Stops all active media tracks.
     * This prevents the webcam from being indicated as active,
     * even if it is no longer used by this component.
     */
    stopMediaTracks() {
        if (this.mediaStream && this.mediaStream.getTracks) {
            // getTracks() returns all media tracks (video+audio)
            this.mediaStream.getTracks()
                .forEach((track) => track.stop());
        }
    }
    /**
     * Unsubscribe from all open subscriptions
     */
    unsubscribeFromSubscriptions() {
        if (this.triggerSubscription) {
            this.triggerSubscription.unsubscribe();
        }
        if (this.switchCameraSubscription) {
            this.switchCameraSubscription.unsubscribe();
        }
    }
    /**
     * Reads available input devices
     */
    detectAvailableDevices() {
        return new Promise((resolve, reject) => {
            WebcamUtil.getAvailableVideoInputs()
                .then((devices) => {
                this.availableVideoInputs = devices;
                resolve(devices);
            })
                .catch(err => {
                this.availableVideoInputs = [];
                reject(err);
            });
        });
    }
};
WebcamComponent.DEFAULT_VIDEO_OPTIONS = { facingMode: 'environment' };
WebcamComponent.DEFAULT_IMAGE_TYPE = 'image/jpeg';
WebcamComponent.DEFAULT_IMAGE_QUALITY = 0.92;
__decorate([
    Input(),
    __metadata("design:type", Number)
], WebcamComponent.prototype, "width", void 0);
__decorate([
    Input(),
    __metadata("design:type", Number)
], WebcamComponent.prototype, "height", void 0);
__decorate([
    Input(),
    __metadata("design:type", Object)
], WebcamComponent.prototype, "videoOptions", void 0);
__decorate([
    Input(),
    __metadata("design:type", Boolean)
], WebcamComponent.prototype, "allowCameraSwitch", void 0);
__decorate([
    Input(),
    __metadata("design:type", Object)
], WebcamComponent.prototype, "mirrorImage", void 0);
__decorate([
    Input(),
    __metadata("design:type", Boolean)
], WebcamComponent.prototype, "captureImageData", void 0);
__decorate([
    Input(),
    __metadata("design:type", String)
], WebcamComponent.prototype, "imageType", void 0);
__decorate([
    Input(),
    __metadata("design:type", Number)
], WebcamComponent.prototype, "imageQuality", void 0);
__decorate([
    Output(),
    __metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "imageCapture", void 0);
__decorate([
    Output(),
    __metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "initError", void 0);
__decorate([
    Output(),
    __metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "imageClick", void 0);
__decorate([
    Output(),
    __metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "cameraSwitched", void 0);
__decorate([
    ViewChild('video', { static: true }),
    __metadata("design:type", Object)
], WebcamComponent.prototype, "video", void 0);
__decorate([
    ViewChild('canvas', { static: true }),
    __metadata("design:type", Object)
], WebcamComponent.prototype, "canvas", void 0);
__decorate([
    Input(),
    __metadata("design:type", Observable),
    __metadata("design:paramtypes", [Observable])
], WebcamComponent.prototype, "trigger", null);
__decorate([
    Input(),
    __metadata("design:type", Observable),
    __metadata("design:paramtypes", [Observable])
], WebcamComponent.prototype, "switchCamera", null);
WebcamComponent = WebcamComponent_1 = __decorate([
    Component({
        selector: 'webcam',
        template: "<div class=\"webcam-wrapper\" (click)=\"imageClick.next();\">\r\n  <video #video [width]=\"videoWidth\" [height]=\"videoHeight\" [class]=\"videoStyleClasses\" autoplay muted playsinline (resize)=\"videoResize()\"></video>\r\n  <div class=\"camera-switch\" *ngIf=\"allowCameraSwitch && availableVideoInputs.length > 1 && videoInitialized\" (click)=\"rotateVideoInput(true)\"></div>\r\n  <canvas #canvas [width]=\"width\" [height]=\"height\"></canvas>\r\n</div>\r\n",
        styles: [".webcam-wrapper{display:inline-block;position:relative;line-height:0}.webcam-wrapper video.mirrored{transform:scale(-1,1)}.webcam-wrapper canvas{display:none}.webcam-wrapper .camera-switch{background-color:rgba(0,0,0,.1);background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE9UlEQVR42u2aT2hdRRTGf+cRQqghSqihdBFDkRISK2KDfzDWxHaRQHEhaINKqa1gKQhd6EZLN+IidCH+Q0oWIkVRC21BQxXRitVaSbKoJSGtYGoK2tQ/tU1jY5v0c5F54Xl7b/KSO/PyEt+3e5f75p7zzZwzZ74zUEIJJfyfYaEGllQGVAGZlENdBy6Z2cSiYFTSKkkfS/pH/nBF0kFJdUW9AiRVASeAukD8DgNrzOySrwEzng18KaDzALXuG8W3AiStAvqBisBRNg40mtlPxbYCOgvgPO4bncWW+JpVeDQXRQhIygDfA00F5r0XuNfMrgclQFI98DDQCNQA5ZFXqoCWBVp8XwHRHeEqcN7loy/NbHBesyqpQ1KfFj/6nC+ZvFaApFrgPaCZpYVvgCfNbDiRAElNwGFg+RIt/X8H2s2s9wYCJDUAR4HqJX7++RN40MwGpgmQVAH0AQ2BPz4AHHPl8nBOAqtyFWQjsA6oL4Ada81sPDv7uwImod8kvSJp9RyS8O2SXnb/DYVd2Y9VSroQ4ANXJO2WVJmixqh0kzMWwL4LkiqRtDnA4D1zmfE8j9g9AezcnAHaPcfXdbfdnPZ2Yps6+DwAvO/Z1naTdApY7Xng48BDZnY1MpMVQBuw3iXc5Tnb0wBwBPjUzP6eoezuArZ6svM0geJLkvZEYnl3nkntoqROSbckSW2Suj3ZOIangc7GPJuUtNGdFIfmMeavktoSSKiW9LMPw30Q8JqkekmjCbOZRhuclLQjgYSNxUBAj6RyZ9ATgUJpUtJTCSR8vpAEXHAyWK5BXYFIGHOlepSAloUk4NEYgyoknQhEwhFJ0e8h6VSaQeerCb5uZgdi9utxYBNwOUD93hIVXswM4INCi6K9wAszFC2DwLOBDjHbYp59karIUnRdzYy/3ClqVklaUhfwTICj7K25OqA7a4wWagVsm4Me/xzwg2cCqqONFzO7DPxSCAJi436GUBgHHguQD2oTlJ55oSzP9ybccsttSJw1szdjFOSnI/8dTCGZHwcORp4Nx7y3B1iZ8/sm4MW8/Euxg5wIsS/HaAp3zeP4/G7obRDXI4jiTIA22H7Xdc7X+S3A5lC7QBQ357aq3VAjCeSkwUfAJrfvz+R8A9ADLAtZB+TinpjC5JMA+//jwPZZnF8G7J+L8z4IWB/zbG+gIujVWfLBW/NStVMmqaG4POJRsIjix7h8IGnLQuoBbQki5sVAJHyYm7YkNaRRtXwQ8G1cHpX0iKRrgUjYno17Sf0LrQhJUkdCeHWkVITGJI0k1QeS3ikGSUzOyJUJJNznYneuOCnpTldcxa2kP3xJYqOeSDjqZG8ShJLnE8TTuMS6Iyu1BW7djZqkfo9N0QOuYJmYQddfB7RG+gLTNzqAY9FrL+5/nwEbvDdJJe3zzOrhNP3AWRqmk55t3ZcBuj3b2gb0Sbrbo/NNzk7fFzu7s/E5EiC+rrmeQU0Kx2skvRFoOx2ZzlmSdgbsw49JetvtBpk8nM64d/cGbNtJ0s7cGyJlwHeEv+t3nqnLSgPAUOSGyG3AHUxdzqoJbEcvcL+ZTeTeEapzJKxgaeOcc/7Mf06D7kFrguS0VDAMtGadv+E47DT9tcChJej8ISfpD+abgTe45uOkFi8mnQ+JBVQ+d4VXuOptjavcyot8pq86mfwk8LWZnaOEEkoooYQSSojDv8AhQNeGfe0jAAAAAElFTkSuQmCC);background-repeat:no-repeat;border-radius:5px;position:absolute;right:13px;top:10px;height:48px;width:48px;background-size:80%;cursor:pointer;background-position:center;transition:background-color .2s}.webcam-wrapper .camera-switch:hover{background-color:rgba(0,0,0,.18)}"]
    })
], WebcamComponent);

const COMPONENTS = [
    WebcamComponent
];
let WebcamModule = class WebcamModule {
};
WebcamModule = __decorate([
    NgModule({
        imports: [
            CommonModule
        ],
        declarations: [
            COMPONENTS
        ],
        exports: [
            COMPONENTS
        ]
    })
], WebcamModule);

class WebcamInitError {
    constructor() {
        this.message = null;
        this.mediaStreamError = null;
    }
}

class WebcamMirrorProperties {
}

export { WebcamComponent, WebcamImage, WebcamInitError, WebcamMirrorProperties, WebcamModule, WebcamUtil };
//# sourceMappingURL=ngx-webcam.js.map
