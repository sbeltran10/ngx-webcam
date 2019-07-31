import * as tslib_1 from "tslib";
var WebcamComponent_1;
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { WebcamImage } from '../domain/webcam-image';
import { Observable } from 'rxjs';
import { WebcamUtil } from '../util/webcam.util';
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
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Number)
], WebcamComponent.prototype, "width", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Number)
], WebcamComponent.prototype, "height", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Object)
], WebcamComponent.prototype, "videoOptions", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Boolean)
], WebcamComponent.prototype, "allowCameraSwitch", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Object)
], WebcamComponent.prototype, "mirrorImage", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Boolean)
], WebcamComponent.prototype, "captureImageData", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", String)
], WebcamComponent.prototype, "imageType", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Number)
], WebcamComponent.prototype, "imageQuality", void 0);
tslib_1.__decorate([
    Output(),
    tslib_1.__metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "imageCapture", void 0);
tslib_1.__decorate([
    Output(),
    tslib_1.__metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "initError", void 0);
tslib_1.__decorate([
    Output(),
    tslib_1.__metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "imageClick", void 0);
tslib_1.__decorate([
    Output(),
    tslib_1.__metadata("design:type", EventEmitter)
], WebcamComponent.prototype, "cameraSwitched", void 0);
tslib_1.__decorate([
    ViewChild('video', { static: true }),
    tslib_1.__metadata("design:type", Object)
], WebcamComponent.prototype, "video", void 0);
tslib_1.__decorate([
    ViewChild('canvas', { static: true }),
    tslib_1.__metadata("design:type", Object)
], WebcamComponent.prototype, "canvas", void 0);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Observable),
    tslib_1.__metadata("design:paramtypes", [Observable])
], WebcamComponent.prototype, "trigger", null);
tslib_1.__decorate([
    Input(),
    tslib_1.__metadata("design:type", Observable),
    tslib_1.__metadata("design:paramtypes", [Observable])
], WebcamComponent.prototype, "switchCamera", null);
WebcamComponent = WebcamComponent_1 = tslib_1.__decorate([
    Component({
        selector: 'webcam',
        template: "<div class=\"webcam-wrapper\" (click)=\"imageClick.next();\">\r\n  <video #video [width]=\"videoWidth\" [height]=\"videoHeight\" [class]=\"videoStyleClasses\" autoplay muted playsinline (resize)=\"videoResize()\"></video>\r\n  <div class=\"camera-switch\" *ngIf=\"allowCameraSwitch && availableVideoInputs.length > 1 && videoInitialized\" (click)=\"rotateVideoInput(true)\"></div>\r\n  <canvas #canvas [width]=\"width\" [height]=\"height\"></canvas>\r\n</div>\r\n",
        styles: [".webcam-wrapper{display:inline-block;position:relative;line-height:0}.webcam-wrapper video.mirrored{transform:scale(-1,1)}.webcam-wrapper canvas{display:none}.webcam-wrapper .camera-switch{background-color:rgba(0,0,0,.1);background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE9UlEQVR42u2aT2hdRRTGf+cRQqghSqihdBFDkRISK2KDfzDWxHaRQHEhaINKqa1gKQhd6EZLN+IidCH+Q0oWIkVRC21BQxXRitVaSbKoJSGtYGoK2tQ/tU1jY5v0c5F54Xl7b/KSO/PyEt+3e5f75p7zzZwzZ74zUEIJJfyfYaEGllQGVAGZlENdBy6Z2cSiYFTSKkkfS/pH/nBF0kFJdUW9AiRVASeAukD8DgNrzOySrwEzng18KaDzALXuG8W3AiStAvqBisBRNg40mtlPxbYCOgvgPO4bncWW+JpVeDQXRQhIygDfA00F5r0XuNfMrgclQFI98DDQCNQA5ZFXqoCWBVp8XwHRHeEqcN7loy/NbHBesyqpQ1KfFj/6nC+ZvFaApFrgPaCZpYVvgCfNbDiRAElNwGFg+RIt/X8H2s2s9wYCJDUAR4HqJX7++RN40MwGpgmQVAH0AQ2BPz4AHHPl8nBOAqtyFWQjsA6oL4Ada81sPDv7uwImod8kvSJp9RyS8O2SXnb/DYVd2Y9VSroQ4ANXJO2WVJmixqh0kzMWwL4LkiqRtDnA4D1zmfE8j9g9AezcnAHaPcfXdbfdnPZ2Yps6+DwAvO/Z1naTdApY7Xng48BDZnY1MpMVQBuw3iXc5Tnb0wBwBPjUzP6eoezuArZ6svM0geJLkvZEYnl3nkntoqROSbckSW2Suj3ZOIangc7GPJuUtNGdFIfmMeavktoSSKiW9LMPw30Q8JqkekmjCbOZRhuclLQjgYSNxUBAj6RyZ9ATgUJpUtJTCSR8vpAEXHAyWK5BXYFIGHOlepSAloUk4NEYgyoknQhEwhFJ0e8h6VSaQeerCb5uZgdi9utxYBNwOUD93hIVXswM4INCi6K9wAszFC2DwLOBDjHbYp59karIUnRdzYy/3ClqVklaUhfwTICj7K25OqA7a4wWagVsm4Me/xzwg2cCqqONFzO7DPxSCAJi436GUBgHHguQD2oTlJ55oSzP9ybccsttSJw1szdjFOSnI/8dTCGZHwcORp4Nx7y3B1iZ8/sm4MW8/Euxg5wIsS/HaAp3zeP4/G7obRDXI4jiTIA22H7Xdc7X+S3A5lC7QBQ357aq3VAjCeSkwUfAJrfvz+R8A9ADLAtZB+TinpjC5JMA+//jwPZZnF8G7J+L8z4IWB/zbG+gIujVWfLBW/NStVMmqaG4POJRsIjix7h8IGnLQuoBbQki5sVAJHyYm7YkNaRRtXwQ8G1cHpX0iKRrgUjYno17Sf0LrQhJUkdCeHWkVITGJI0k1QeS3ikGSUzOyJUJJNznYneuOCnpTldcxa2kP3xJYqOeSDjqZG8ShJLnE8TTuMS6Iyu1BW7djZqkfo9N0QOuYJmYQddfB7RG+gLTNzqAY9FrL+5/nwEbvDdJJe3zzOrhNP3AWRqmk55t3ZcBuj3b2gb0Sbrbo/NNzk7fFzu7s/E5EiC+rrmeQU0Kx2skvRFoOx2ZzlmSdgbsw49JetvtBpk8nM64d/cGbNtJ0s7cGyJlwHeEv+t3nqnLSgPAUOSGyG3AHUxdzqoJbEcvcL+ZTeTeEapzJKxgaeOcc/7Mf06D7kFrguS0VDAMtGadv+E47DT9tcChJej8ISfpD+abgTe45uOkFi8mnQ+JBVQ+d4VXuOptjavcyot8pq86mfwk8LWZnaOEEkoooYQSSojDv8AhQNeGfe0jAAAAAElFTkSuQmCC);background-repeat:no-repeat;border-radius:5px;position:absolute;right:13px;top:10px;height:48px;width:48px;background-size:80%;cursor:pointer;background-position:center;transition:background-color .2s}.webcam-wrapper .camera-switch:hover{background-color:rgba(0,0,0,.18)}"]
    })
], WebcamComponent);
export { WebcamComponent };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViY2FtLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiJuZzovL25neC13ZWJjYW0vIiwic291cmNlcyI6WyJzcmMvYXBwL21vZHVsZXMvd2ViY2FtL3dlYmNhbS93ZWJjYW0uY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsT0FBTyxFQUFpQixTQUFTLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBYSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRTVHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNyRCxPQUFPLEVBQUUsVUFBVSxFQUFnQixNQUFNLE1BQU0sQ0FBQztBQUNoRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFRakQsSUFBYSxlQUFlLHVCQUE1QixNQUFhLGVBQWU7SUFMNUI7UUFVRSxxREFBcUQ7UUFDckMsVUFBSyxHQUFXLEdBQUcsQ0FBQztRQUNwQyxzREFBc0Q7UUFDdEMsV0FBTSxHQUFXLEdBQUcsQ0FBQztRQUNyQyxtRkFBbUY7UUFDbkUsaUJBQVksR0FBMEIsaUJBQWUsQ0FBQyxxQkFBcUIsQ0FBQztRQUM1Rix1SEFBdUg7UUFDdkcsc0JBQWlCLEdBQVksSUFBSSxDQUFDO1FBR2xELHlGQUF5RjtRQUN6RSxxQkFBZ0IsR0FBWSxLQUFLLENBQUM7UUFDbEQscURBQXFEO1FBQ3JDLGNBQVMsR0FBVyxpQkFBZSxDQUFDLGtCQUFrQixDQUFDO1FBQ3ZFLGlGQUFpRjtRQUNqRSxpQkFBWSxHQUFXLGlCQUFlLENBQUMscUJBQXFCLENBQUM7UUFFN0UsK0RBQStEO1FBQzlDLGlCQUFZLEdBQThCLElBQUksWUFBWSxFQUFlLENBQUM7UUFDM0YseUZBQXlGO1FBQ3hFLGNBQVMsR0FBa0MsSUFBSSxZQUFZLEVBQW1CLENBQUM7UUFDaEcsOENBQThDO1FBQzdCLGVBQVUsR0FBdUIsSUFBSSxZQUFZLEVBQVEsQ0FBQztRQUMzRSwyRUFBMkU7UUFDMUQs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QUFDN0Usa0NBQWtCLEdBQVcsWUFBWSxDQUFDO0FBQzFDLHFDQUFxQixHQUFXLElBQUksQ0FBQztBQUczQztJQUFSLEtBQUssRUFBRTs7OENBQTRCO0FBRTNCO0lBQVIsS0FBSyxFQUFFOzsrQ0FBNkI7QUFFNUI7SUFBUixLQUFLLEVBQUU7O3FEQUFvRjtBQUVuRjtJQUFSLEtBQUssRUFBRTs7MERBQTBDO0FBRXpDO0lBQVIsS0FBSyxFQUFFOztvREFBcUQ7QUFFcEQ7SUFBUixLQUFLLEVBQUU7O3lEQUEwQztBQUV6QztJQUFSLEtBQUssRUFBRTs7a0RBQStEO0FBRTlEO0lBQVIsS0FBSyxFQUFFOztxREFBcUU7QUFHbkU7SUFBVCxNQUFNLEVBQUU7c0NBQXNCLFlBQVk7cURBQWdEO0FBRWpGO0lBQVQsTUFBTSxFQUFFO3NDQUFtQixZQUFZO2tEQUF3RDtBQUV0RjtJQUFULE1BQU0sRUFBRTtzQ0FBb0IsWUFBWTttREFBa0M7QUFFakU7SUFBVCxNQUFNLEVBQUU7c0NBQXdCLFlBQVk7dURBQXNDO0FBb0I3QztJQUFyQyxTQUFTLENBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDOzs4Q0FBb0I7QUFFbEI7SUFBdEMsU0FBUyxDQUFDLFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQzs7K0NBQXFCO0FBUzNEO0lBREMsS0FBSyxFQUFFO3NDQUNxQixVQUFVOzZDQUFWLFVBQVU7OENBU3RDO0FBVUQ7SUFEQyxLQUFLLEVBQUU7c0NBQytCLFVBQVU7NkNBQVYsVUFBVTttREFlaEQ7QUE5RlUsZUFBZTtJQUwzQixTQUFTLENBQUM7UUFDVCxRQUFRLEVBQUUsUUFBUTtRQUNsQiwyZEFBc0M7O0tBRXZDLENBQUM7R0FDVyxlQUFlLENBa2EzQjtTQWxhWSxlQUFlIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWZ0ZXJWaWV3SW5pdCwgQ29tcG9uZW50LCBFdmVudEVtaXR0ZXIsIElucHV0LCBPbkRlc3Ryb3ksIE91dHB1dCwgVmlld0NoaWxkIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IFdlYmNhbUluaXRFcnJvciB9IGZyb20gJy4uL2RvbWFpbi93ZWJjYW0taW5pdC1lcnJvcic7XHJcbmltcG9ydCB7IFdlYmNhbUltYWdlIH0gZnJvbSAnLi4vZG9tYWluL3dlYmNhbS1pbWFnZSc7XHJcbmltcG9ydCB7IE9ic2VydmFibGUsIFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBXZWJjYW1VdGlsIH0gZnJvbSAnLi4vdXRpbC93ZWJjYW0udXRpbCc7XHJcbmltcG9ydCB7IFdlYmNhbU1pcnJvclByb3BlcnRpZXMgfSBmcm9tICcuLi9kb21haW4vd2ViY2FtLW1pcnJvci1wcm9wZXJ0aWVzJztcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gIHNlbGVjdG9yOiAnd2ViY2FtJyxcclxuICB0ZW1wbGF0ZVVybDogJy4vd2ViY2FtLmNvbXBvbmVudC5odG1sJyxcclxuICBzdHlsZVVybHM6IFsnLi93ZWJjYW0uY29tcG9uZW50LnNjc3MnXVxyXG59KVxyXG5leHBvcnQgY2xhc3MgV2ViY2FtQ29tcG9uZW50IGltcGxlbWVudHMgQWZ0ZXJWaWV3SW5pdCwgT25EZXN0cm95IHtcclxuICBwcml2YXRlIHN0YXRpYyBERUZBVUxUX1ZJREVPX09QVElPTlM6IE1lZGlhVHJhY2tDb25zdHJhaW50cyA9IHsgZmFjaW5nTW9kZTogJ2Vudmlyb25tZW50JyB9O1xyXG4gIHByaXZhdGUgc3RhdGljIERFRkFVTFRfSU1BR0VfVFlQRTogc3RyaW5nID0gJ2ltYWdlL2pwZWcnO1xyXG4gIHByaXZhdGUgc3RhdGljIERFRkFVTFRfSU1BR0VfUVVBTElUWTogbnVtYmVyID0gMC45MjtcclxuXHJcbiAgLyoqIERlZmluZXMgdGhlIG1heCB3aWR0aCBvZiB0aGUgd2ViY2FtIGFyZWEgaW4gcHggKi9cclxuICBASW5wdXQoKSBwdWJsaWMgd2lkdGg6IG51bWJlciA9IDY0MDtcclxuICAvKiogRGVmaW5lcyB0aGUgbWF4IGhlaWdodCBvZiB0aGUgd2ViY2FtIGFyZWEgaW4gcHggKi9cclxuICBASW5wdXQoKSBwdWJsaWMgaGVpZ2h0OiBudW1iZXIgPSA0ODA7XHJcbiAgLyoqIERlZmluZXMgYmFzZSBjb25zdHJhaW50cyB0byBhcHBseSB3aGVuIHJlcXVlc3RpbmcgdmlkZW8gdHJhY2sgZnJvbSBVc2VyTWVkaWEgKi9cclxuICBASW5wdXQoKSBwdWJsaWMgdmlkZW9PcHRpb25zOiBNZWRpYVRyYWNrQ29uc3RyYWludHMgPSBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9WSURFT19PUFRJT05TO1xyXG4gIC8qKiBGbGFnIHRvIGVuYWJsZS9kaXNhYmxlIGNhbWVyYSBzd2l0Y2guIElmIGVuYWJsZWQsIGEgc3dpdGNoIGljb24gd2lsbCBiZSBkaXNwbGF5ZWQgaWYgbXVsdGlwbGUgY2FtZXJhcyB3ZXJlIGZvdW5kICovXHJcbiAgQElucHV0KCkgcHVibGljIGFsbG93Q2FtZXJhU3dpdGNoOiBib29sZWFuID0gdHJ1ZTtcclxuICAvKiogUGFyYW1ldGVyIHRvIGNvbnRyb2wgaW1hZ2UgbWlycm9yaW5nIChpLmUuIGZvciB1c2VyLWZhY2luZyBjYW1lcmEpLiBbXCJhdXRvXCIsIFwiYWx3YXlzXCIsIFwibmV2ZXJcIl0gKi9cclxuICBASW5wdXQoKSBwdWJsaWMgbWlycm9ySW1hZ2U6IHN0cmluZyB8IFdlYmNhbU1pcnJvclByb3BlcnRpZXM7XHJcbiAgLyoqIEZsYWcgdG8gY29udHJvbCB3aGV0aGVyIGFuIEltYWdlRGF0YSBvYmplY3QgaXMgc3RvcmVkIGludG8gdGhlIFdlYmNhbUltYWdlIG9iamVjdC4gKi9cclxuICBASW5wdXQoKSBwdWJsaWMgY2FwdHVyZUltYWdlRGF0YTogYm9vbGVhbiA9IGZhbHNlO1xyXG4gIC8qKiBUaGUgaW1hZ2UgdHlwZSB0byB1c2Ugd2hlbiBjYXB0dXJpbmcgc25hcHNob3RzICovXHJcbiAgQElucHV0KCkgcHVibGljIGltYWdlVHlwZTogc3RyaW5nID0gV2ViY2FtQ29tcG9uZW50LkRFRkFVTFRfSU1BR0VfVFlQRTtcclxuICAvKiogVGhlIGltYWdlIHF1YWxpdHkgdG8gdXNlIHdoZW4gY2FwdHVyaW5nIHNuYXBzaG90cyAobnVtYmVyIGJldHdlZW4gMCBhbmQgMSkgKi9cclxuICBASW5wdXQoKSBwdWJsaWMgaW1hZ2VRdWFsaXR5OiBudW1iZXIgPSBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9JTUFHRV9RVUFMSVRZO1xyXG5cclxuICAvKiogRXZlbnRFbWl0dGVyIHdoaWNoIGZpcmVzIHdoZW4gYW4gaW1hZ2UgaGFzIGJlZW4gY2FwdHVyZWQgKi9cclxuICBAT3V0cHV0KCkgcHVibGljIGltYWdlQ2FwdHVyZTogRXZlbnRFbWl0dGVyPFdlYmNhbUltYWdlPiA9IG5ldyBFdmVudEVtaXR0ZXI8V2ViY2FtSW1hZ2U+KCk7XHJcbiAgLyoqIEVtaXRzIGEgbWVkaWFFcnJvciBpZiB3ZWJjYW0gY2Fubm90IGJlIGluaXRpYWxpemVkIChlLmcuIG1pc3NpbmcgdXNlciBwZXJtaXNzaW9ucykgKi9cclxuICBAT3V0cHV0KCkgcHVibGljIGluaXRFcnJvcjogRXZlbnRFbWl0dGVyPFdlYmNhbUluaXRFcnJvcj4gPSBuZXcgRXZlbnRFbWl0dGVyPFdlYmNhbUluaXRFcnJvcj4oKTtcclxuICAvKiogRW1pdHMgd2hlbiB0aGUgd2ViY2FtIHZpZGVvIHdhcyBjbGlja2VkICovXHJcbiAgQE91dHB1dCgpIHB1YmxpYyBpbWFnZUNsaWNrOiBFdmVudEVtaXR0ZXI8dm9pZD4gPSBuZXcgRXZlbnRFbWl0dGVyPHZvaWQ+KCk7XHJcbiAgLyoqIEVtaXRzIHRoZSBhY3RpdmUgZGV2aWNlSWQgYWZ0ZXIgdGhlIGFjdGl2ZSB2aWRlbyBkZXZpY2Ugd2FzIHN3aXRjaGVkICovXHJcbiAgQE91dHB1dCgpIHB1YmxpYyBjYW1lcmFTd2l0Y2hlZDogRXZlbnRFbWl0dGVyPHN0cmluZz4gPSBuZXcgRXZlbnRFbWl0dGVyPHN0cmluZz4oKTtcclxuXHJcbiAgLyoqIGluZGljYXRlcyBpZiBsb2FkZWQgZmlyc3QgdGltZSBvbiBwYWdlICovXHJcbiAgcHVibGljIGZpcnN0VGltZUxvYWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgLyoqIGF2YWlsYWJsZSB2aWRlbyBkZXZpY2VzICovXHJcbiAgcHVibGljIGF2YWlsYWJsZVZpZGVvSW5wdXRzOiBNZWRpYURldmljZUluZm9bXSA9IFtdO1xyXG5cclxuICAvKiogSW5kaWNhdGVzIHdoZXRoZXIgdGhlIHZpZGVvIGRldmljZSBpcyByZWFkeSB0byBiZSBzd2l0Y2hlZCAqL1xyXG4gIHB1YmxpYyB2aWRlb0luaXRpYWxpemVkOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gIC8qKiBJZiB0aGUgT2JzZXJ2YWJsZSByZXByZXNlbnRlZCBieSB0aGlzIHN1YnNjcmlwdGlvbiBlbWl0cywgYW4gaW1hZ2Ugd2lsbCBiZSBjYXB0dXJlZCBhbmQgZW1pdHRlZCB0aHJvdWdoXHJcbiAgICogdGhlICdpbWFnZUNhcHR1cmUnIEV2ZW50RW1pdHRlciAqL1xyXG4gIHByaXZhdGUgdHJpZ2dlclN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xyXG4gIC8qKiBJbmRleCBvZiBhY3RpdmUgdmlkZW8gaW4gYXZhaWxhYmxlVmlkZW9JbnB1dHMgKi9cclxuICBwcml2YXRlIGFjdGl2ZVZpZGVvSW5wdXRJbmRleDogbnVtYmVyID0gLTE7XHJcbiAgLyoqIFN1YnNjcmlwdGlvbiB0byBzd2l0Y2hDYW1lcmEgZXZlbnRzICovXHJcbiAgcHJpdmF0ZSBzd2l0Y2hDYW1lcmFTdWJzY3JpcHRpb246IFN1YnNjcmlwdGlvbjtcclxuICAvKiogTWVkaWFTdHJlYW0gb2JqZWN0IGluIHVzZSBmb3Igc3RyZWFtaW5nIFVzZXJNZWRpYSBkYXRhICovXHJcbiAgcHJpdmF0ZSBtZWRpYVN0cmVhbTogTWVkaWFTdHJlYW0gPSBudWxsO1xyXG4gIEBWaWV3Q2hpbGQoJ3ZpZGVvJywgeyBzdGF0aWM6IHRydWUgfSkgcHJpdmF0ZSB2aWRlbzogYW55O1xyXG4gIC8qKiBDYW52YXMgZm9yIFZpZGVvIFNuYXBzaG90cyAqL1xyXG4gIEBWaWV3Q2hpbGQoJ2NhbnZhcycsIHsgc3RhdGljOiB0cnVlIH0pIHByaXZhdGUgY2FudmFzOiBhbnk7XHJcblxyXG4gIC8qKiB3aWR0aCBhbmQgaGVpZ2h0IG9mIHRoZSBhY3RpdmUgdmlkZW8gc3RyZWFtICovXHJcbiAgcHJpdmF0ZSBhY3RpdmVWaWRlb1NldHRpbmdzOiBNZWRpYVRyYWNrU2V0dGluZ3MgPSBudWxsO1xyXG5cclxuICAvKipcclxuICAgKiBJZiB0aGUgZ2l2ZW4gT2JzZXJ2YWJsZSBlbWl0cywgYW4gaW1hZ2Ugd2lsbCBiZSBjYXB0dXJlZCBhbmQgZW1pdHRlZCB0aHJvdWdoICdpbWFnZUNhcHR1cmUnIEV2ZW50RW1pdHRlclxyXG4gICAqL1xyXG4gIEBJbnB1dCgpXHJcbiAgcHVibGljIHNldCB0cmlnZ2VyICh0cmlnZ2VyOiBPYnNlcnZhYmxlPHZvaWQ+KSB7XHJcbiAgICBpZiAodGhpcy50cmlnZ2VyU3Vic2NyaXB0aW9uKSB7XHJcbiAgICAgIHRoaXMudHJpZ2dlclN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFN1YnNjcmliZSB0byBldmVudHMgZnJvbSB0aGlzIE9ic2VydmFibGUgdG8gdGFrZSBzbmFwc2hvdHNcclxuICAgIHRoaXMudHJpZ2dlclN1YnNjcmlwdGlvbiA9IHRyaWdnZXIuc3Vic2NyaWJlKCgpID0+IHtcclxuICAgICAgdGhpcy50YWtlU25hcHNob3QoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSWYgdGhlIGdpdmVuIE9ic2VydmFibGUgZW1pdHMsIHRoZSBhY3RpdmUgd2ViY2FtIHdpbGwgYmUgc3dpdGNoZWQgdG8gdGhlIG9uZSBpbmRpY2F0ZWQgYnkgdGhlIGVtaXR0ZWQgdmFsdWUuXHJcbiAgICogQHBhcmFtIHN3aXRjaENhbWVyYSBJbmRpY2F0ZXMgd2hpY2ggd2ViY2FtIHRvIHN3aXRjaCB0b1xyXG4gICAqICAgdHJ1ZTogY3ljbGUgZm9yd2FyZHMgdGhyb3VnaCBhdmFpbGFibGUgd2ViY2Ftc1xyXG4gICAqICAgZmFsc2U6IGN5Y2xlIGJhY2t3YXJkcyB0aHJvdWdoIGF2YWlsYWJsZSB3ZWJjYW1zXHJcbiAgICogICBzdHJpbmc6IGFjdGl2YXRlIHRoZSB3ZWJjYW0gd2l0aCB0aGUgZ2l2ZW4gaWRcclxuICAgKi9cclxuICBASW5wdXQoKVxyXG4gIHB1YmxpYyBzZXQgc3dpdGNoQ2FtZXJhIChzd2l0Y2hDYW1lcmE6IE9ic2VydmFibGU8Ym9vbGVhbiB8IHN0cmluZz4pIHtcclxuICAgIGlmICh0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFN1YnNjcmliZSB0byBldmVudHMgZnJvbSB0aGlzIE9ic2VydmFibGUgdG8gc3dpdGNoIHZpZGVvIGRldmljZVxyXG4gICAgdGhpcy5zd2l0Y2hDYW1lcmFTdWJzY3JpcHRpb24gPSBzd2l0Y2hDYW1lcmEuc3Vic2NyaWJlKCh2YWx1ZTogYm9vbGVhbiB8IHN0cmluZykgPT4ge1xyXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIC8vIGRldmljZUlkIHdhcyBzcGVjaWZpZWRcclxuICAgICAgICB0aGlzLnN3aXRjaFRvVmlkZW9JbnB1dCh2YWx1ZSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gZGlyZWN0aW9uIHdhcyBzcGVjaWZpZWRcclxuICAgICAgICB0aGlzLnJvdGF0ZVZpZGVvSW5wdXQodmFsdWUgIT09IGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgTWVkaWFUcmFja0NvbnN0cmFpbnRzIHRvIHJlcXVlc3Qgc3RyZWFtaW5nIHRoZSBnaXZlbiBkZXZpY2VcclxuICAgKiBAcGFyYW0gZGV2aWNlSWRcclxuICAgKiBAcGFyYW0gYmFzZU1lZGlhVHJhY2tDb25zdHJhaW50cyBiYXNlIGNvbnN0cmFpbnRzIHRvIG1lcmdlIGRldmljZUlkLWNvbnN0cmFpbnQgaW50b1xyXG4gICAqIEByZXR1cm5zXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0TWVkaWFDb25zdHJhaW50c0ZvckRldmljZSAoZGV2aWNlSWQ6IHN0cmluZywgYmFzZU1lZGlhVHJhY2tDb25zdHJhaW50czogTWVkaWFUcmFja0NvbnN0cmFpbnRzKTogTWVkaWFUcmFja0NvbnN0cmFpbnRzIHtcclxuICAgIGNvbnN0IHJlc3VsdDogTWVkaWFUcmFja0NvbnN0cmFpbnRzID0gYmFzZU1lZGlhVHJhY2tDb25zdHJhaW50cyA/IGJhc2VNZWRpYVRyYWNrQ29uc3RyYWludHMgOiB0aGlzLkRFRkFVTFRfVklERU9fT1BUSU9OUztcclxuICAgIGlmIChkZXZpY2VJZCkge1xyXG4gICAgICByZXN1bHQuZGV2aWNlSWQgPSB7IGV4YWN0OiBkZXZpY2VJZCB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUcmllcyB0byBoYXJ2ZXN0IHRoZSBkZXZpY2VJZCBmcm9tIHRoZSBnaXZlbiBtZWRpYVN0cmVhbVRyYWNrIG9iamVjdC5cclxuICAgKiBCcm93c2VycyBwb3B1bGF0ZSB0aGlzIG9iamVjdCBkaWZmZXJlbnRseTsgdGhpcyBtZXRob2QgdHJpZXMgc29tZSBkaWZmZXJlbnQgYXBwcm9hY2hlc1xyXG4gICAqIHRvIHJlYWQgdGhlIGlkLlxyXG4gICAqIEBwYXJhbSBtZWRpYVN0cmVhbVRyYWNrXHJcbiAgICogQHJldHVybnMgZGV2aWNlSWQgaWYgZm91bmQgaW4gdGhlIG1lZGlhU3RyZWFtVHJhY2tcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyBnZXREZXZpY2VJZEZyb21NZWRpYVN0cmVhbVRyYWNrIChtZWRpYVN0cmVhbVRyYWNrOiBNZWRpYVN0cmVhbVRyYWNrKTogc3RyaW5nIHtcclxuICAgIGlmIChtZWRpYVN0cmVhbVRyYWNrLmdldFNldHRpbmdzICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKSAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldFNldHRpbmdzKCkuZGV2aWNlSWQpIHtcclxuICAgICAgcmV0dXJuIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKS5kZXZpY2VJZDtcclxuICAgIH0gZWxzZSBpZiAobWVkaWFTdHJlYW1UcmFjay5nZXRDb25zdHJhaW50cyAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRDb25zdHJhaW50cygpLmRldmljZUlkKSB7XHJcbiAgICAgIGNvbnN0IGRldmljZUlkT2JqOiBDb25zdHJhaW5ET01TdHJpbmcgPSBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkuZGV2aWNlSWQ7XHJcbiAgICAgIHJldHVybiBXZWJjYW1Db21wb25lbnQuZ2V0VmFsdWVGcm9tQ29uc3RyYWluRE9NU3RyaW5nKGRldmljZUlkT2JqKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRyaWVzIHRvIGhhcnZlc3QgdGhlIGZhY2luZ01vZGUgZnJvbSB0aGUgZ2l2ZW4gbWVkaWFTdHJlYW1UcmFjayBvYmplY3QuXHJcbiAgICogQnJvd3NlcnMgcG9wdWxhdGUgdGhpcyBvYmplY3QgZGlmZmVyZW50bHk7IHRoaXMgbWV0aG9kIHRyaWVzIHNvbWUgZGlmZmVyZW50IGFwcHJvYWNoZXNcclxuICAgKiB0byByZWFkIHRoZSB2YWx1ZS5cclxuICAgKiBAcGFyYW0gbWVkaWFTdHJlYW1UcmFja1xyXG4gICAqIEByZXR1cm5zIGZhY2luZ01vZGUgaWYgZm91bmQgaW4gdGhlIG1lZGlhU3RyZWFtVHJhY2tcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyBnZXRGYWNpbmdNb2RlRnJvbU1lZGlhU3RyZWFtVHJhY2sgKG1lZGlhU3RyZWFtVHJhY2s6IE1lZGlhU3RyZWFtVHJhY2spOiBzdHJpbmcge1xyXG4gICAgaWYgKG1lZGlhU3RyZWFtVHJhY2spIHtcclxuICAgICAgaWYgKG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKS5mYWNpbmdNb2RlKSB7XHJcbiAgICAgICAgcmV0dXJuIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKS5mYWNpbmdNb2RlO1xyXG4gICAgICB9IGVsc2UgaWYgKG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRDb25zdHJhaW50cygpICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKS5mYWNpbmdNb2RlKSB7XHJcbiAgICAgICAgY29uc3QgZmFjaW5nTW9kZUNvbnN0cmFpbnQ6IENvbnN0cmFpbkRPTVN0cmluZyA9IG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKS5mYWNpbmdNb2RlO1xyXG4gICAgICAgIHJldHVybiBXZWJjYW1Db21wb25lbnQuZ2V0VmFsdWVGcm9tQ29uc3RyYWluRE9NU3RyaW5nKGZhY2luZ01vZGVDb25zdHJhaW50KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBnaXZlbiBtZWRpYVN0cmVhbVRyYWNrIGNsYWltcyBpdHNlbGYgYXMgdXNlciBmYWNpbmdcclxuICAgKiBAcGFyYW0gbWVkaWFTdHJlYW1UcmFja1xyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhdGljIGlzVXNlckZhY2luZyAobWVkaWFTdHJlYW1UcmFjazogTWVkaWFTdHJlYW1UcmFjayk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgZmFjaW5nTW9kZTogc3RyaW5nID0gV2ViY2FtQ29tcG9uZW50LmdldEZhY2luZ01vZGVGcm9tTWVkaWFTdHJlYW1UcmFjayhtZWRpYVN0cmVhbVRyYWNrKTtcclxuICAgIHJldHVybiBmYWNpbmdNb2RlID8gJ3VzZXInID09PSBmYWNpbmdNb2RlLnRvTG93ZXJDYXNlKCkgOiBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEV4dHJhY3RzIHRoZSB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBDb25zdHJhaW5ET01TdHJpbmdcclxuICAgKiBAcGFyYW0gY29uc3RyYWluRE9NU3RyaW5nXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0VmFsdWVGcm9tQ29uc3RyYWluRE9NU3RyaW5nIChjb25zdHJhaW5ET01TdHJpbmc6IENvbnN0cmFpbkRPTVN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBpZiAoY29uc3RyYWluRE9NU3RyaW5nKSB7XHJcbiAgICAgIGlmIChjb25zdHJhaW5ET01TdHJpbmcgaW5zdGFuY2VvZiBTdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gU3RyaW5nKGNvbnN0cmFpbkRPTVN0cmluZyk7XHJcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjb25zdHJhaW5ET01TdHJpbmcpICYmIEFycmF5KGNvbnN0cmFpbkRPTVN0cmluZykubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHJldHVybiBTdHJpbmcoY29uc3RyYWluRE9NU3RyaW5nWzBdKTtcclxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29uc3RyYWluRE9NU3RyaW5nID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIGlmIChjb25zdHJhaW5ET01TdHJpbmdbJ2V4YWN0J10pIHtcclxuICAgICAgICAgIHJldHVybiBTdHJpbmcoY29uc3RyYWluRE9NU3RyaW5nWydleGFjdCddKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGNvbnN0cmFpbkRPTVN0cmluZ1snaWRlYWwnXSkge1xyXG4gICAgICAgICAgcmV0dXJuIFN0cmluZyhjb25zdHJhaW5ET01TdHJpbmdbJ2lkZWFsJ10pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG5nQWZ0ZXJWaWV3SW5pdCAoKTogdm9pZCB7XHJcbiAgICB0aGlzLmRldGVjdEF2YWlsYWJsZURldmljZXMoKVxyXG4gICAgICAudGhlbigoZGV2aWNlczogTWVkaWFEZXZpY2VJbmZvW10pID0+IHtcclxuICAgICAgICAvLyBzdGFydCBmaXJzdCBkZXZpY2VcclxuICAgICAgICB0aGlzLnN3aXRjaFRvVmlkZW9JbnB1dChkZXZpY2VzLmxlbmd0aCA+IDAgPyBkZXZpY2VzWzBdLmRldmljZUlkIDogbnVsbCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaCgoZXJyOiBzdHJpbmcpID0+IHtcclxuICAgICAgICB0aGlzLmluaXRFcnJvci5uZXh0KDxXZWJjYW1Jbml0RXJyb3I+eyBtZXNzYWdlOiBlcnIgfSk7XHJcbiAgICAgICAgLy8gZmFsbGJhY2s6IHN0aWxsIHRyeSB0byBsb2FkIHdlYmNhbSwgZXZlbiBpZiBkZXZpY2UgZW51bWVyYXRpb24gZmFpbGVkXHJcbiAgICAgICAgdGhpcy5zd2l0Y2hUb1ZpZGVvSW5wdXQobnVsbCk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG5nT25EZXN0cm95ICgpOiB2b2lkIHtcclxuICAgIHRoaXMuc3RvcE1lZGlhVHJhY2tzKCk7XHJcbiAgICB0aGlzLnVuc3Vic2NyaWJlRnJvbVN1YnNjcmlwdGlvbnMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRha2VzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgd2ViY2FtJ3MgdmlldyBhbmQgZW1pdHMgdGhlIGltYWdlIGFzIGFuIGV2ZW50XHJcbiAgICovXHJcbiAgcHVibGljIHRha2VTbmFwc2hvdCAoKTogdm9pZCB7XHJcbiAgICAvLyBzZXQgY2FudmFzIHNpemUgdG8gYWN0dWFsIHZpZGVvIHNpemVcclxuICAgIGNvbnN0IF92aWRlbyA9IHRoaXMubmF0aXZlVmlkZW9FbGVtZW50O1xyXG4gICAgY29uc3QgZGltZW5zaW9ucyA9IHsgd2lkdGg6IHRoaXMud2lkdGgsIGhlaWdodDogdGhpcy5oZWlnaHQgfTtcclxuICAgIGlmIChfdmlkZW8udmlkZW9XaWR0aCkge1xyXG4gICAgICBkaW1lbnNpb25zLndpZHRoID0gX3ZpZGVvLnZpZGVvV2lkdGg7XHJcbiAgICAgIGRpbWVuc2lvbnMuaGVpZ2h0ID0gX3ZpZGVvLnZpZGVvSGVpZ2h0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IF9jYW52YXMgPSB0aGlzLmNhbnZhcy5uYXRpdmVFbGVtZW50O1xyXG4gICAgX2NhbnZhcy53aWR0aCA9IGRpbWVuc2lvbnMud2lkdGg7XHJcbiAgICBfY2FudmFzLmhlaWdodCA9IGRpbWVuc2lvbnMuaGVpZ2h0O1xyXG5cclxuICAgIC8vIHBhaW50IHNuYXBzaG90IGltYWdlIHRvIGNhbnZhc1xyXG4gICAgY29uc3QgY29udGV4dDJkID0gX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xyXG4gICAgY29udGV4dDJkLmRyYXdJbWFnZShfdmlkZW8sIDAsIDApO1xyXG5cclxuICAgIC8vIHJlYWQgY2FudmFzIGNvbnRlbnQgYXMgaW1hZ2VcclxuICAgIGNvbnN0IG1pbWVUeXBlOiBzdHJpbmcgPSB0aGlzLmltYWdlVHlwZSA/IHRoaXMuaW1hZ2VUeXBlIDogV2ViY2FtQ29tcG9uZW50LkRFRkFVTFRfSU1BR0VfVFlQRTtcclxuICAgIGNvbnN0IHF1YWxpdHk6IG51bWJlciA9IHRoaXMuaW1hZ2VRdWFsaXR5ID8gdGhpcy5pbWFnZVF1YWxpdHkgOiBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9JTUFHRV9RVUFMSVRZO1xyXG4gICAgY29uc3QgZGF0YVVybDogc3RyaW5nID0gX2NhbnZhcy50b0RhdGFVUkwobWltZVR5cGUsIHF1YWxpdHkpO1xyXG5cclxuICAgIC8vIGdldCB0aGUgSW1hZ2VEYXRhIG9iamVjdCBmcm9tIHRoZSBjYW52YXMnIGNvbnRleHQuXHJcbiAgICBsZXQgaW1hZ2VEYXRhOiBJbWFnZURhdGEgPSBudWxsO1xyXG5cclxuICAgIGlmICh0aGlzLmNhcHR1cmVJbWFnZURhdGEpIHtcclxuICAgICAgaW1hZ2VEYXRhID0gY29udGV4dDJkLmdldEltYWdlRGF0YSgwLCAwLCBfY2FudmFzLndpZHRoLCBfY2FudmFzLmhlaWdodCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5pbWFnZUNhcHR1cmUubmV4dChuZXcgV2ViY2FtSW1hZ2UoZGF0YVVybCwgbWltZVR5cGUsIGltYWdlRGF0YSkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3dpdGNoZXMgdG8gdGhlIG5leHQvcHJldmlvdXMgdmlkZW8gZGV2aWNlXHJcbiAgICogQHBhcmFtIGZvcndhcmRcclxuICAgKi9cclxuICBwdWJsaWMgcm90YXRlVmlkZW9JbnB1dCAoZm9yd2FyZDogYm9vbGVhbikge1xyXG4gICAgaWYgKHRoaXMuYXZhaWxhYmxlVmlkZW9JbnB1dHMgJiYgdGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cy5sZW5ndGggPiAxKSB7XHJcbiAgICAgIGNvbnN0IGluY3JlbWVudDogbnVtYmVyID0gZm9yd2FyZCA/IDEgOiAodGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cy5sZW5ndGggLSAxKTtcclxuICAgICAgY29uc3QgbmV4dElucHV0SW5kZXggPSAodGhpcy5hY3RpdmVWaWRlb0lucHV0SW5kZXggKyBpbmNyZW1lbnQpICUgdGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cy5sZW5ndGg7XHJcbiAgICAgIHRoaXMuc3dpdGNoVG9WaWRlb0lucHV0KHRoaXMuYXZhaWxhYmxlVmlkZW9JbnB1dHNbbmV4dElucHV0SW5kZXhdLmRldmljZUlkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN3aXRjaGVzIHRoZSBjYW1lcmEtdmlldyB0byB0aGUgc3BlY2lmaWVkIHZpZGVvIGRldmljZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBzd2l0Y2hUb1ZpZGVvSW5wdXQgKGRldmljZUlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMudmlkZW9Jbml0aWFsaXplZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5zdG9wTWVkaWFUcmFja3MoKTtcclxuICAgIHRoaXMuaW5pdFdlYmNhbShkZXZpY2VJZCwgdGhpcy52aWRlb09wdGlvbnMpO1xyXG4gIH1cclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEV2ZW50LWhhbmRsZXIgZm9yIHZpZGVvIHJlc2l6ZSBldmVudC5cclxuICAgKiBUcmlnZ2VycyBBbmd1bGFyIGNoYW5nZSBkZXRlY3Rpb24gc28gdGhhdCBuZXcgdmlkZW8gZGltZW5zaW9ucyBnZXQgYXBwbGllZFxyXG4gICAqL1xyXG4gIHB1YmxpYyB2aWRlb1Jlc2l6ZSAoKTogdm9pZCB7XHJcbiAgICAvLyBoZXJlIHRvIHRyaWdnZXIgQW5ndWxhciBjaGFuZ2UgZGV0ZWN0aW9uXHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHZpZGVvV2lkdGggKCkge1xyXG4gICAgY29uc3QgdmlkZW9SYXRpbyA9IHRoaXMuZ2V0VmlkZW9Bc3BlY3RSYXRpbygpO1xyXG4gICAgcmV0dXJuIE1hdGgubWluKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0ICogdmlkZW9SYXRpbyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHZpZGVvSGVpZ2h0ICgpIHtcclxuICAgIGNvbnN0IHZpZGVvUmF0aW8gPSB0aGlzLmdldFZpZGVvQXNwZWN0UmF0aW8oKTtcclxuICAgIHJldHVybiBNYXRoLm1pbih0aGlzLmhlaWdodCwgdGhpcy53aWR0aCAvIHZpZGVvUmF0aW8pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCB2aWRlb1N0eWxlQ2xhc3NlcyAoKSB7XHJcbiAgICBsZXQgY2xhc3Nlczogc3RyaW5nID0gJyc7XHJcblxyXG4gICAgaWYgKHRoaXMuaXNNaXJyb3JJbWFnZSgpKSB7XHJcbiAgICAgIGNsYXNzZXMgKz0gJ21pcnJvcmVkICc7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGNsYXNzZXMudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBuYXRpdmVWaWRlb0VsZW1lbnQgKCkge1xyXG4gICAgcmV0dXJuIHRoaXMudmlkZW8ubmF0aXZlRWxlbWVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIHZpZGVvIGFzcGVjdCByYXRpbyBvZiB0aGUgYWN0aXZlIHZpZGVvIHN0cmVhbVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0VmlkZW9Bc3BlY3RSYXRpbyAoKTogbnVtYmVyIHtcclxuICAgIC8vIGNhbGN1bGF0ZSByYXRpbyBmcm9tIHZpZGVvIGVsZW1lbnQgZGltZW5zaW9ucyBpZiBwcmVzZW50XHJcbiAgICBjb25zdCB2aWRlb0VsZW1lbnQgPSB0aGlzLm5hdGl2ZVZpZGVvRWxlbWVudDtcclxuICAgIGlmICh2aWRlb0VsZW1lbnQudmlkZW9XaWR0aCAmJiB2aWRlb0VsZW1lbnQudmlkZW9XaWR0aCA+IDAgJiZcclxuICAgICAgdmlkZW9FbGVtZW50LnZpZGVvSGVpZ2h0ICYmIHZpZGVvRWxlbWVudC52aWRlb0hlaWdodCA+IDApIHtcclxuXHJcbiAgICAgIHJldHVybiB2aWRlb0VsZW1lbnQudmlkZW9XaWR0aCAvIHZpZGVvRWxlbWVudC52aWRlb0hlaWdodDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBub3RoaW5nIHByZXNlbnQgLSBjYWxjdWxhdGUgcmF0aW8gYmFzZWQgb24gd2lkdGgvaGVpZ2h0IHBhcmFtc1xyXG4gICAgcmV0dXJuIHRoaXMud2lkdGggLyB0aGlzLmhlaWdodDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXQgd2ViY2FtIGxpdmUgdmlld1xyXG4gICAqL1xyXG4gIHByaXZhdGUgaW5pdFdlYmNhbSAoZGV2aWNlSWQ6IHN0cmluZywgdXNlclZpZGVvVHJhY2tDb25zdHJhaW50czogTWVkaWFUcmFja0NvbnN0cmFpbnRzKSB7XHJcbiAgICBjb25zdCBfdmlkZW8gPSB0aGlzLm5hdGl2ZVZpZGVvRWxlbWVudDtcclxuICAgIGlmIChuYXZpZ2F0b3IubWVkaWFEZXZpY2VzICYmIG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKSB7XHJcblxyXG4gICAgICAvLyBtZXJnZSBkZXZpY2VJZCAtPiB1c2VyVmlkZW9UcmFja0NvbnN0cmFpbnRzXHJcbiAgICAgIGxldCB2aWRlb1RyYWNrQ29uc3RyYWludHM7XHJcbiAgICAgIGlmICh0aGlzLmZpcnN0VGltZUxvYWQpXHJcbiAgICAgICAgdmlkZW9UcmFja0NvbnN0cmFpbnRzID0gV2ViY2FtQ29tcG9uZW50LmdldE1lZGlhQ29uc3RyYWludHNGb3JEZXZpY2UoZGV2aWNlSWQsIHVzZXJWaWRlb1RyYWNrQ29uc3RyYWludHMpO1xyXG4gICAgICBlbHNlIHtcclxuICAgICAgICB0aGlzLmZpcnN0VGltZUxvYWQgPSB0cnVlXHJcbiAgICAgICAgdmlkZW9UcmFja0NvbnN0cmFpbnRzID0gV2ViY2FtQ29tcG9uZW50LkRFRkFVTFRfVklERU9fT1BUSU9OUztcclxuICAgICAgfVxyXG5cclxuICAgICAgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoPE1lZGlhU3RyZWFtQ29uc3RyYWludHM+eyB2aWRlbzogdmlkZW9UcmFja0NvbnN0cmFpbnRzIH0pXHJcbiAgICAgICAgLnRoZW4oKHN0cmVhbTogTWVkaWFTdHJlYW0pID0+IHtcclxuICAgICAgICAgIHRoaXMubWVkaWFTdHJlYW0gPSBzdHJlYW07XHJcbiAgICAgICAgICBfdmlkZW8uc3JjT2JqZWN0ID0gc3RyZWFtO1xyXG4gICAgICAgICAgX3ZpZGVvLnBsYXkoKTtcclxuXHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZVZpZGVvU2V0dGluZ3MgPSBzdHJlYW0uZ2V0VmlkZW9UcmFja3MoKVswXS5nZXRTZXR0aW5ncygpO1xyXG4gICAgICAgICAgY29uc3QgYWN0aXZlRGV2aWNlSWQ6IHN0cmluZyA9IFdlYmNhbUNvbXBvbmVudC5nZXREZXZpY2VJZEZyb21NZWRpYVN0cmVhbVRyYWNrKHN0cmVhbS5nZXRWaWRlb1RyYWNrcygpWzBdKTtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlVmlkZW9JbnB1dEluZGV4ID0gYWN0aXZlRGV2aWNlSWQgPyB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzXHJcbiAgICAgICAgICAgIC5maW5kSW5kZXgoKG1lZGlhRGV2aWNlSW5mbzogTWVkaWFEZXZpY2VJbmZvKSA9PiBtZWRpYURldmljZUluZm8uZGV2aWNlSWQgPT09IGFjdGl2ZURldmljZUlkKSA6IC0xO1xyXG4gICAgICAgICAgdGhpcy52aWRlb0luaXRpYWxpemVkID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICB0aGlzLmNhbWVyYVN3aXRjaGVkLm5leHQoYWN0aXZlRGV2aWNlSWQpO1xyXG5cclxuICAgICAgICAgIC8vIEluaXRpYWwgZGV0ZWN0IG1heSBydW4gYmVmb3JlIHVzZXIgZ2F2ZSBwZXJtaXNzaW9ucywgcmV0dXJuaW5nIG5vIGRldmljZUlkcy4gVGhpcyBwcmV2ZW50cyBsYXRlciBjYW1lcmEgc3dpdGNoZXMuICgjNDcpXHJcbiAgICAgICAgICAvLyBSdW4gZGV0ZWN0IG9uY2UgYWdhaW4gd2l0aGluIGdldFVzZXJNZWRpYSBjYWxsYmFjaywgdG8gbWFrZSBzdXJlIHRoaXMgdGltZSB3ZSBoYXZlIHBlcm1pc3Npb25zIGFuZCBnZXQgZGV2aWNlSWRzLlxyXG4gICAgICAgICAgdGhpcy5kZXRlY3RBdmFpbGFibGVEZXZpY2VzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goKGVycjogTWVkaWFTdHJlYW1FcnJvcikgPT4ge1xyXG4gICAgICAgICAgdGhpcy5pbml0RXJyb3IubmV4dCg8V2ViY2FtSW5pdEVycm9yPnsgbWVzc2FnZTogZXJyLm1lc3NhZ2UsIG1lZGlhU3RyZWFtRXJyb3I6IGVyciB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuaW5pdEVycm9yLm5leHQoPFdlYmNhbUluaXRFcnJvcj57IG1lc3NhZ2U6ICdDYW5ub3QgcmVhZCBVc2VyTWVkaWEgZnJvbSBNZWRpYURldmljZXMuJyB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0QWN0aXZlVmlkZW9UcmFjayAoKTogTWVkaWFTdHJlYW1UcmFjayB7XHJcbiAgICByZXR1cm4gdGhpcy5tZWRpYVN0cmVhbSA/IHRoaXMubWVkaWFTdHJlYW0uZ2V0VmlkZW9UcmFja3MoKVswXSA6IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGlzTWlycm9ySW1hZ2UgKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKCF0aGlzLmdldEFjdGl2ZVZpZGVvVHJhY2soKSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gY2hlY2sgZm9yIGV4cGxpY2l0IG1pcnJvciBvdmVycmlkZSBwYXJhbWV0ZXJcclxuICAgIHtcclxuICAgICAgbGV0IG1pcnJvcjogc3RyaW5nID0gJ2F1dG8nO1xyXG4gICAgICBpZiAodGhpcy5taXJyb3JJbWFnZSkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5taXJyb3JJbWFnZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgIG1pcnJvciA9IFN0cmluZyh0aGlzLm1pcnJvckltYWdlKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBXZWJjYW1NaXJyb3JQcm9wZXJ0aWVzXHJcbiAgICAgICAgICBpZiAodGhpcy5taXJyb3JJbWFnZS54KSB7XHJcbiAgICAgICAgICAgIG1pcnJvciA9IHRoaXMubWlycm9ySW1hZ2UueC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgc3dpdGNoIChtaXJyb3IpIHtcclxuICAgICAgICBjYXNlICdhbHdheXMnOlxyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgY2FzZSAnbmV2ZXInOlxyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZGVmYXVsdDogZW5hYmxlIG1pcnJvcmluZyBpZiB3ZWJjYW0gaXMgdXNlciBmYWNpbmdcclxuICAgIHJldHVybiBXZWJjYW1Db21wb25lbnQuaXNVc2VyRmFjaW5nKHRoaXMuZ2V0QWN0aXZlVmlkZW9UcmFjaygpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0b3BzIGFsbCBhY3RpdmUgbWVkaWEgdHJhY2tzLlxyXG4gICAqIFRoaXMgcHJldmVudHMgdGhlIHdlYmNhbSBmcm9tIGJlaW5nIGluZGljYXRlZCBhcyBhY3RpdmUsXHJcbiAgICogZXZlbiBpZiBpdCBpcyBubyBsb25nZXIgdXNlZCBieSB0aGlzIGNvbXBvbmVudC5cclxuICAgKi9cclxuICBwcml2YXRlIHN0b3BNZWRpYVRyYWNrcyAoKSB7XHJcbiAgICBpZiAodGhpcy5tZWRpYVN0cmVhbSAmJiB0aGlzLm1lZGlhU3RyZWFtLmdldFRyYWNrcykge1xyXG4gICAgICAvLyBnZXRUcmFja3MoKSByZXR1cm5zIGFsbCBtZWRpYSB0cmFja3MgKHZpZGVvK2F1ZGlvKVxyXG4gICAgICB0aGlzLm1lZGlhU3RyZWFtLmdldFRyYWNrcygpXHJcbiAgICAgICAgLmZvckVhY2goKHRyYWNrOiBNZWRpYVN0cmVhbVRyYWNrKSA9PiB0cmFjay5zdG9wKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5zdWJzY3JpYmUgZnJvbSBhbGwgb3BlbiBzdWJzY3JpcHRpb25zXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB1bnN1YnNjcmliZUZyb21TdWJzY3JpcHRpb25zICgpIHtcclxuICAgIGlmICh0aGlzLnRyaWdnZXJTdWJzY3JpcHRpb24pIHtcclxuICAgICAgdGhpcy50cmlnZ2VyU3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5zd2l0Y2hDYW1lcmFTdWJzY3JpcHRpb24pIHtcclxuICAgICAgdGhpcy5zd2l0Y2hDYW1lcmFTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlYWRzIGF2YWlsYWJsZSBpbnB1dCBkZXZpY2VzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBkZXRlY3RBdmFpbGFibGVEZXZpY2VzICgpOiBQcm9taXNlPE1lZGlhRGV2aWNlSW5mb1tdPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBXZWJjYW1VdGlsLmdldEF2YWlsYWJsZVZpZGVvSW5wdXRzKClcclxuICAgICAgICAudGhlbigoZGV2aWNlczogTWVkaWFEZXZpY2VJbmZvW10pID0+IHtcclxuICAgICAgICAgIHRoaXMuYXZhaWxhYmxlVmlkZW9JbnB1dHMgPSBkZXZpY2VzO1xyXG4gICAgICAgICAgcmVzb2x2ZShkZXZpY2VzKTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgdGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cyA9IFtdO1xyXG4gICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG59XHJcbiJdfQ==