import * as tslib_1 from "tslib";
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { WebcamImage } from '../domain/webcam-image';
import { Observable } from 'rxjs';
import { WebcamUtil } from '../util/webcam.util';
var WebcamComponent = /** @class */ (function () {
    function WebcamComponent() {
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
    WebcamComponent_1 = WebcamComponent;
    Object.defineProperty(WebcamComponent.prototype, "trigger", {
        /**
         * If the given Observable emits, an image will be captured and emitted through 'imageCapture' EventEmitter
         */
        set: function (trigger) {
            var _this = this;
            if (this.triggerSubscription) {
                this.triggerSubscription.unsubscribe();
            }
            // Subscribe to events from this Observable to take snapshots
            this.triggerSubscription = trigger.subscribe(function () {
                _this.takeSnapshot();
            });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebcamComponent.prototype, "switchCamera", {
        /**
         * If the given Observable emits, the active webcam will be switched to the one indicated by the emitted value.
         * @param switchCamera Indicates which webcam to switch to
         *   true: cycle forwards through available webcams
         *   false: cycle backwards through available webcams
         *   string: activate the webcam with the given id
         */
        set: function (switchCamera) {
            var _this = this;
            if (this.switchCameraSubscription) {
                this.switchCameraSubscription.unsubscribe();
            }
            // Subscribe to events from this Observable to switch video device
            this.switchCameraSubscription = switchCamera.subscribe(function (value) {
                if (typeof value === 'string') {
                    // deviceId was specified
                    _this.switchToVideoInput(value);
                }
                else {
                    // direction was specified
                    _this.rotateVideoInput(value !== false);
                }
            });
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Get MediaTrackConstraints to request streaming the given device
     * @param deviceId
     * @param baseMediaTrackConstraints base constraints to merge deviceId-constraint into
     * @returns
     */
    WebcamComponent.getMediaConstraintsForDevice = function (deviceId, baseMediaTrackConstraints) {
        var result = baseMediaTrackConstraints ? baseMediaTrackConstraints : this.DEFAULT_VIDEO_OPTIONS;
        if (deviceId) {
            result.deviceId = { exact: deviceId };
        }
        return result;
    };
    /**
     * Tries to harvest the deviceId from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the id.
     * @param mediaStreamTrack
     * @returns deviceId if found in the mediaStreamTrack
     */
    WebcamComponent.getDeviceIdFromMediaStreamTrack = function (mediaStreamTrack) {
        if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().deviceId) {
            return mediaStreamTrack.getSettings().deviceId;
        }
        else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().deviceId) {
            var deviceIdObj = mediaStreamTrack.getConstraints().deviceId;
            return WebcamComponent_1.getValueFromConstrainDOMString(deviceIdObj);
        }
    };
    /**
     * Tries to harvest the facingMode from the given mediaStreamTrack object.
     * Browsers populate this object differently; this method tries some different approaches
     * to read the value.
     * @param mediaStreamTrack
     * @returns facingMode if found in the mediaStreamTrack
     */
    WebcamComponent.getFacingModeFromMediaStreamTrack = function (mediaStreamTrack) {
        if (mediaStreamTrack) {
            if (mediaStreamTrack.getSettings && mediaStreamTrack.getSettings() && mediaStreamTrack.getSettings().facingMode) {
                return mediaStreamTrack.getSettings().facingMode;
            }
            else if (mediaStreamTrack.getConstraints && mediaStreamTrack.getConstraints() && mediaStreamTrack.getConstraints().facingMode) {
                var facingModeConstraint = mediaStreamTrack.getConstraints().facingMode;
                return WebcamComponent_1.getValueFromConstrainDOMString(facingModeConstraint);
            }
        }
    };
    /**
     * Determines whether the given mediaStreamTrack claims itself as user facing
     * @param mediaStreamTrack
     */
    WebcamComponent.isUserFacing = function (mediaStreamTrack) {
        var facingMode = WebcamComponent_1.getFacingModeFromMediaStreamTrack(mediaStreamTrack);
        return facingMode ? 'user' === facingMode.toLowerCase() : false;
    };
    /**
     * Extracts the value from the given ConstrainDOMString
     * @param constrainDOMString
     */
    WebcamComponent.getValueFromConstrainDOMString = function (constrainDOMString) {
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
    };
    WebcamComponent.prototype.ngAfterViewInit = function () {
        var _this = this;
        this.detectAvailableDevices()
            .then(function (devices) {
            // start first device
            _this.switchToVideoInput(devices.length > 0 ? devices[0].deviceId : null);
        })
            .catch(function (err) {
            _this.initError.next({ message: err });
            // fallback: still try to load webcam, even if device enumeration failed
            _this.switchToVideoInput(null);
        });
    };
    WebcamComponent.prototype.ngOnDestroy = function () {
        this.stopMediaTracks();
        this.unsubscribeFromSubscriptions();
    };
    /**
     * Takes a snapshot of the current webcam's view and emits the image as an event
     */
    WebcamComponent.prototype.takeSnapshot = function () {
        // set canvas size to actual video size
        var _video = this.nativeVideoElement;
        var dimensions = { width: this.width, height: this.height };
        if (_video.videoWidth) {
            dimensions.width = _video.videoWidth;
            dimensions.height = _video.videoHeight;
        }
        var _canvas = this.canvas.nativeElement;
        _canvas.width = dimensions.width;
        _canvas.height = dimensions.height;
        // paint snapshot image to canvas
        var context2d = _canvas.getContext('2d');
        context2d.drawImage(_video, 0, 0);
        // read canvas content as image
        var mimeType = this.imageType ? this.imageType : WebcamComponent_1.DEFAULT_IMAGE_TYPE;
        var quality = this.imageQuality ? this.imageQuality : WebcamComponent_1.DEFAULT_IMAGE_QUALITY;
        var dataUrl = _canvas.toDataURL(mimeType, quality);
        // get the ImageData object from the canvas' context.
        var imageData = null;
        if (this.captureImageData) {
            imageData = context2d.getImageData(0, 0, _canvas.width, _canvas.height);
        }
        this.imageCapture.next(new WebcamImage(dataUrl, mimeType, imageData));
    };
    /**
     * Switches to the next/previous video device
     * @param forward
     */
    WebcamComponent.prototype.rotateVideoInput = function (forward) {
        if (this.availableVideoInputs && this.availableVideoInputs.length > 1) {
            var increment = forward ? 1 : (this.availableVideoInputs.length - 1);
            var nextInputIndex = (this.activeVideoInputIndex + increment) % this.availableVideoInputs.length;
            this.switchToVideoInput(this.availableVideoInputs[nextInputIndex].deviceId);
        }
    };
    /**
     * Switches the camera-view to the specified video device
     */
    WebcamComponent.prototype.switchToVideoInput = function (deviceId) {
        this.videoInitialized = false;
        this.stopMediaTracks();
        this.initWebcam(deviceId, this.videoOptions);
    };
    /**
     * Event-handler for video resize event.
     * Triggers Angular change detection so that new video dimensions get applied
     */
    WebcamComponent.prototype.videoResize = function () {
        // here to trigger Angular change detection
    };
    Object.defineProperty(WebcamComponent.prototype, "videoWidth", {
        get: function () {
            var videoRatio = this.getVideoAspectRatio();
            return Math.min(this.width, this.height * videoRatio);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebcamComponent.prototype, "videoHeight", {
        get: function () {
            var videoRatio = this.getVideoAspectRatio();
            return Math.min(this.height, this.width / videoRatio);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebcamComponent.prototype, "videoStyleClasses", {
        get: function () {
            var classes = '';
            if (this.isMirrorImage()) {
                classes += 'mirrored ';
            }
            return classes.trim();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebcamComponent.prototype, "nativeVideoElement", {
        get: function () {
            return this.video.nativeElement;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Returns the video aspect ratio of the active video stream
     */
    WebcamComponent.prototype.getVideoAspectRatio = function () {
        // calculate ratio from video element dimensions if present
        var videoElement = this.nativeVideoElement;
        if (videoElement.videoWidth && videoElement.videoWidth > 0 &&
            videoElement.videoHeight && videoElement.videoHeight > 0) {
            return videoElement.videoWidth / videoElement.videoHeight;
        }
        // nothing present - calculate ratio based on width/height params
        return this.width / this.height;
    };
    /**
     * Init webcam live view
     */
    WebcamComponent.prototype.initWebcam = function (deviceId, userVideoTrackConstraints) {
        var _this = this;
        var _video = this.nativeVideoElement;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // merge deviceId -> userVideoTrackConstraints
            var videoTrackConstraints = void 0;
            if (this.firstTimeLoad)
                videoTrackConstraints = WebcamComponent_1.getMediaConstraintsForDevice(deviceId, userVideoTrackConstraints);
            else {
                this.firstTimeLoad = true;
                videoTrackConstraints = WebcamComponent_1.DEFAULT_VIDEO_OPTIONS;
            }
            navigator.mediaDevices.getUserMedia({ video: videoTrackConstraints })
                .then(function (stream) {
                _this.mediaStream = stream;
                _video.srcObject = stream;
                _video.play();
                _this.activeVideoSettings = stream.getVideoTracks()[0].getSettings();
                var activeDeviceId = WebcamComponent_1.getDeviceIdFromMediaStreamTrack(stream.getVideoTracks()[0]);
                _this.activeVideoInputIndex = activeDeviceId ? _this.availableVideoInputs
                    .findIndex(function (mediaDeviceInfo) { return mediaDeviceInfo.deviceId === activeDeviceId; }) : -1;
                _this.videoInitialized = true;
                _this.cameraSwitched.next(activeDeviceId);
                // Initial detect may run before user gave permissions, returning no deviceIds. This prevents later camera switches. (#47)
                // Run detect once again within getUserMedia callback, to make sure this time we have permissions and get deviceIds.
                _this.detectAvailableDevices();
            })
                .catch(function (err) {
                _this.initError.next({ message: err.message, mediaStreamError: err });
            });
        }
        else {
            this.initError.next({ message: 'Cannot read UserMedia from MediaDevices.' });
        }
    };
    WebcamComponent.prototype.getActiveVideoTrack = function () {
        return this.mediaStream ? this.mediaStream.getVideoTracks()[0] : null;
    };
    WebcamComponent.prototype.isMirrorImage = function () {
        if (!this.getActiveVideoTrack()) {
            return false;
        }
        // check for explicit mirror override parameter
        {
            var mirror = 'auto';
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
    };
    /**
     * Stops all active media tracks.
     * This prevents the webcam from being indicated as active,
     * even if it is no longer used by this component.
     */
    WebcamComponent.prototype.stopMediaTracks = function () {
        if (this.mediaStream && this.mediaStream.getTracks) {
            // getTracks() returns all media tracks (video+audio)
            this.mediaStream.getTracks()
                .forEach(function (track) { return track.stop(); });
        }
    };
    /**
     * Unsubscribe from all open subscriptions
     */
    WebcamComponent.prototype.unsubscribeFromSubscriptions = function () {
        if (this.triggerSubscription) {
            this.triggerSubscription.unsubscribe();
        }
        if (this.switchCameraSubscription) {
            this.switchCameraSubscription.unsubscribe();
        }
    };
    /**
     * Reads available input devices
     */
    WebcamComponent.prototype.detectAvailableDevices = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            WebcamUtil.getAvailableVideoInputs()
                .then(function (devices) {
                _this.availableVideoInputs = devices;
                resolve(devices);
            })
                .catch(function (err) {
                _this.availableVideoInputs = [];
                reject(err);
            });
        });
    };
    var WebcamComponent_1;
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
    return WebcamComponent;
}());
export { WebcamComponent };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViY2FtLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiJuZzovL25neC13ZWJjYW0vIiwic291cmNlcyI6WyJzcmMvYXBwL21vZHVsZXMvd2ViY2FtL3dlYmNhbS93ZWJjYW0uY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPLEVBQWlCLFNBQVMsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFhLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFNUcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxVQUFVLEVBQWdCLE1BQU0sTUFBTSxDQUFDO0FBQ2hELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQVFqRDtJQUxBO1FBVUUscURBQXFEO1FBQ3JDLFVBQUssR0FBVyxHQUFHLENBQUM7UUFDcEMsc0RBQXNEO1FBQ3RDLFdBQU0sR0FBVyxHQUFHLENBQUM7UUFDckMsbUZBQW1GO1FBQ25FLGlCQUFZLEdBQTBCLGlCQUFlLENBQUMscUJBQXFCLENBQUM7UUFDNUYsdUhBQXVIO1FBQ3ZHLHNCQUFpQixHQUFZLElBQUksQ0FBQztRQUdsRCx5RkFBeUY7UUFDekUscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ2xELHFEQUFxRDtRQUNyQyxjQUFTLEdBQVcsaUJBQWUsQ0FBQyxrQkFBa0IsQ0FBQztRQUN2RSxpRkFBaUY7UUFDakUsaUJBQVksR0FBVyxpQkFBZSxDQUFDLHFCQUFxQixDQUFDO1FBRTdFLCtEQUErRDtRQUM5QyxpQkFBWSxHQUE4QixJQUFJLFlBQVksRUFBZSxDQUFDO1FBQzNGLHlGQUF5RjtRQUN4RSxjQUFTLEdBQWtDLElBQUksWUFBWSxFQUFtQixDQUFDO1FBQ2hHLDhDQUE4QztRQUM3QixlQUFVLEdBQXVCLElBQUksWUFBWSxFQUFRLENBQUM7UUFDM0UsMkVBQTJFO1FBQzFELG1CQUFjLEdBQXlCLElBQUksWUFBWSxFQUFVLENB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SUFBRCxzQkFBQztDQUFBLEFBbGFELElBa2FDO1NBbGFZLGVBQWUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBZnRlclZpZXdJbml0LCBDb21wb25lbnQsIEV2ZW50RW1pdHRlciwgSW5wdXQsIE9uRGVzdHJveSwgT3V0cHV0LCBWaWV3Q2hpbGQgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgV2ViY2FtSW5pdEVycm9yIH0gZnJvbSAnLi4vZG9tYWluL3dlYmNhbS1pbml0LWVycm9yJztcclxuaW1wb3J0IHsgV2ViY2FtSW1hZ2UgfSBmcm9tICcuLi9kb21haW4vd2ViY2FtLWltYWdlJztcclxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IFdlYmNhbVV0aWwgfSBmcm9tICcuLi91dGlsL3dlYmNhbS51dGlsJztcclxuaW1wb3J0IHsgV2ViY2FtTWlycm9yUHJvcGVydGllcyB9IGZyb20gJy4uL2RvbWFpbi93ZWJjYW0tbWlycm9yLXByb3BlcnRpZXMnO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICd3ZWJjYW0nLFxyXG4gIHRlbXBsYXRlVXJsOiAnLi93ZWJjYW0uY29tcG9uZW50Lmh0bWwnLFxyXG4gIHN0eWxlVXJsczogWycuL3dlYmNhbS5jb21wb25lbnQuc2NzcyddXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBXZWJjYW1Db21wb25lbnQgaW1wbGVtZW50cyBBZnRlclZpZXdJbml0LCBPbkRlc3Ryb3kge1xyXG4gIHByaXZhdGUgc3RhdGljIERFRkFVTFRfVklERU9fT1BUSU9OUzogTWVkaWFUcmFja0NvbnN0cmFpbnRzID0geyBmYWNpbmdNb2RlOiAnZW52aXJvbm1lbnQnIH07XHJcbiAgcHJpdmF0ZSBzdGF0aWMgREVGQVVMVF9JTUFHRV9UWVBFOiBzdHJpbmcgPSAnaW1hZ2UvanBlZyc7XHJcbiAgcHJpdmF0ZSBzdGF0aWMgREVGQVVMVF9JTUFHRV9RVUFMSVRZOiBudW1iZXIgPSAwLjkyO1xyXG5cclxuICAvKiogRGVmaW5lcyB0aGUgbWF4IHdpZHRoIG9mIHRoZSB3ZWJjYW0gYXJlYSBpbiBweCAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyB3aWR0aDogbnVtYmVyID0gNjQwO1xyXG4gIC8qKiBEZWZpbmVzIHRoZSBtYXggaGVpZ2h0IG9mIHRoZSB3ZWJjYW0gYXJlYSBpbiBweCAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBoZWlnaHQ6IG51bWJlciA9IDQ4MDtcclxuICAvKiogRGVmaW5lcyBiYXNlIGNvbnN0cmFpbnRzIHRvIGFwcGx5IHdoZW4gcmVxdWVzdGluZyB2aWRlbyB0cmFjayBmcm9tIFVzZXJNZWRpYSAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyB2aWRlb09wdGlvbnM6IE1lZGlhVHJhY2tDb25zdHJhaW50cyA9IFdlYmNhbUNvbXBvbmVudC5ERUZBVUxUX1ZJREVPX09QVElPTlM7XHJcbiAgLyoqIEZsYWcgdG8gZW5hYmxlL2Rpc2FibGUgY2FtZXJhIHN3aXRjaC4gSWYgZW5hYmxlZCwgYSBzd2l0Y2ggaWNvbiB3aWxsIGJlIGRpc3BsYXllZCBpZiBtdWx0aXBsZSBjYW1lcmFzIHdlcmUgZm91bmQgKi9cclxuICBASW5wdXQoKSBwdWJsaWMgYWxsb3dDYW1lcmFTd2l0Y2g6IGJvb2xlYW4gPSB0cnVlO1xyXG4gIC8qKiBQYXJhbWV0ZXIgdG8gY29udHJvbCBpbWFnZSBtaXJyb3JpbmcgKGkuZS4gZm9yIHVzZXItZmFjaW5nIGNhbWVyYSkuIFtcImF1dG9cIiwgXCJhbHdheXNcIiwgXCJuZXZlclwiXSAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBtaXJyb3JJbWFnZTogc3RyaW5nIHwgV2ViY2FtTWlycm9yUHJvcGVydGllcztcclxuICAvKiogRmxhZyB0byBjb250cm9sIHdoZXRoZXIgYW4gSW1hZ2VEYXRhIG9iamVjdCBpcyBzdG9yZWQgaW50byB0aGUgV2ViY2FtSW1hZ2Ugb2JqZWN0LiAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBjYXB0dXJlSW1hZ2VEYXRhOiBib29sZWFuID0gZmFsc2U7XHJcbiAgLyoqIFRoZSBpbWFnZSB0eXBlIHRvIHVzZSB3aGVuIGNhcHR1cmluZyBzbmFwc2hvdHMgKi9cclxuICBASW5wdXQoKSBwdWJsaWMgaW1hZ2VUeXBlOiBzdHJpbmcgPSBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9JTUFHRV9UWVBFO1xyXG4gIC8qKiBUaGUgaW1hZ2UgcXVhbGl0eSB0byB1c2Ugd2hlbiBjYXB0dXJpbmcgc25hcHNob3RzIChudW1iZXIgYmV0d2VlbiAwIGFuZCAxKSAqL1xyXG4gIEBJbnB1dCgpIHB1YmxpYyBpbWFnZVF1YWxpdHk6IG51bWJlciA9IFdlYmNhbUNvbXBvbmVudC5ERUZBVUxUX0lNQUdFX1FVQUxJVFk7XHJcblxyXG4gIC8qKiBFdmVudEVtaXR0ZXIgd2hpY2ggZmlyZXMgd2hlbiBhbiBpbWFnZSBoYXMgYmVlbiBjYXB0dXJlZCAqL1xyXG4gIEBPdXRwdXQoKSBwdWJsaWMgaW1hZ2VDYXB0dXJlOiBFdmVudEVtaXR0ZXI8V2ViY2FtSW1hZ2U+ID0gbmV3IEV2ZW50RW1pdHRlcjxXZWJjYW1JbWFnZT4oKTtcclxuICAvKiogRW1pdHMgYSBtZWRpYUVycm9yIGlmIHdlYmNhbSBjYW5ub3QgYmUgaW5pdGlhbGl6ZWQgKGUuZy4gbWlzc2luZyB1c2VyIHBlcm1pc3Npb25zKSAqL1xyXG4gIEBPdXRwdXQoKSBwdWJsaWMgaW5pdEVycm9yOiBFdmVudEVtaXR0ZXI8V2ViY2FtSW5pdEVycm9yPiA9IG5ldyBFdmVudEVtaXR0ZXI8V2ViY2FtSW5pdEVycm9yPigpO1xyXG4gIC8qKiBFbWl0cyB3aGVuIHRoZSB3ZWJjYW0gdmlkZW8gd2FzIGNsaWNrZWQgKi9cclxuICBAT3V0cHV0KCkgcHVibGljIGltYWdlQ2xpY2s6IEV2ZW50RW1pdHRlcjx2b2lkPiA9IG5ldyBFdmVudEVtaXR0ZXI8dm9pZD4oKTtcclxuICAvKiogRW1pdHMgdGhlIGFjdGl2ZSBkZXZpY2VJZCBhZnRlciB0aGUgYWN0aXZlIHZpZGVvIGRldmljZSB3YXMgc3dpdGNoZWQgKi9cclxuICBAT3V0cHV0KCkgcHVibGljIGNhbWVyYVN3aXRjaGVkOiBFdmVudEVtaXR0ZXI8c3RyaW5nPiA9IG5ldyBFdmVudEVtaXR0ZXI8c3RyaW5nPigpO1xyXG5cclxuICAvKiogaW5kaWNhdGVzIGlmIGxvYWRlZCBmaXJzdCB0aW1lIG9uIHBhZ2UgKi9cclxuICBwdWJsaWMgZmlyc3RUaW1lTG9hZDogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAvKiogYXZhaWxhYmxlIHZpZGVvIGRldmljZXMgKi9cclxuICBwdWJsaWMgYXZhaWxhYmxlVmlkZW9JbnB1dHM6IE1lZGlhRGV2aWNlSW5mb1tdID0gW107XHJcblxyXG4gIC8qKiBJbmRpY2F0ZXMgd2hldGhlciB0aGUgdmlkZW8gZGV2aWNlIGlzIHJlYWR5IHRvIGJlIHN3aXRjaGVkICovXHJcbiAgcHVibGljIHZpZGVvSW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgLyoqIElmIHRoZSBPYnNlcnZhYmxlIHJlcHJlc2VudGVkIGJ5IHRoaXMgc3Vic2NyaXB0aW9uIGVtaXRzLCBhbiBpbWFnZSB3aWxsIGJlIGNhcHR1cmVkIGFuZCBlbWl0dGVkIHRocm91Z2hcclxuICAgKiB0aGUgJ2ltYWdlQ2FwdHVyZScgRXZlbnRFbWl0dGVyICovXHJcbiAgcHJpdmF0ZSB0cmlnZ2VyU3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb247XHJcbiAgLyoqIEluZGV4IG9mIGFjdGl2ZSB2aWRlbyBpbiBhdmFpbGFibGVWaWRlb0lucHV0cyAqL1xyXG4gIHByaXZhdGUgYWN0aXZlVmlkZW9JbnB1dEluZGV4OiBudW1iZXIgPSAtMTtcclxuICAvKiogU3Vic2NyaXB0aW9uIHRvIHN3aXRjaENhbWVyYSBldmVudHMgKi9cclxuICBwcml2YXRlIHN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xyXG4gIC8qKiBNZWRpYVN0cmVhbSBvYmplY3QgaW4gdXNlIGZvciBzdHJlYW1pbmcgVXNlck1lZGlhIGRhdGEgKi9cclxuICBwcml2YXRlIG1lZGlhU3RyZWFtOiBNZWRpYVN0cmVhbSA9IG51bGw7XHJcbiAgQFZpZXdDaGlsZCgndmlkZW8nLCB7IHN0YXRpYzogdHJ1ZSB9KSBwcml2YXRlIHZpZGVvOiBhbnk7XHJcbiAgLyoqIENhbnZhcyBmb3IgVmlkZW8gU25hcHNob3RzICovXHJcbiAgQFZpZXdDaGlsZCgnY2FudmFzJywgeyBzdGF0aWM6IHRydWUgfSkgcHJpdmF0ZSBjYW52YXM6IGFueTtcclxuXHJcbiAgLyoqIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhlIGFjdGl2ZSB2aWRlbyBzdHJlYW0gKi9cclxuICBwcml2YXRlIGFjdGl2ZVZpZGVvU2V0dGluZ3M6IE1lZGlhVHJhY2tTZXR0aW5ncyA9IG51bGw7XHJcblxyXG4gIC8qKlxyXG4gICAqIElmIHRoZSBnaXZlbiBPYnNlcnZhYmxlIGVtaXRzLCBhbiBpbWFnZSB3aWxsIGJlIGNhcHR1cmVkIGFuZCBlbWl0dGVkIHRocm91Z2ggJ2ltYWdlQ2FwdHVyZScgRXZlbnRFbWl0dGVyXHJcbiAgICovXHJcbiAgQElucHV0KClcclxuICBwdWJsaWMgc2V0IHRyaWdnZXIgKHRyaWdnZXI6IE9ic2VydmFibGU8dm9pZD4pIHtcclxuICAgIGlmICh0aGlzLnRyaWdnZXJTdWJzY3JpcHRpb24pIHtcclxuICAgICAgdGhpcy50cmlnZ2VyU3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU3Vic2NyaWJlIHRvIGV2ZW50cyBmcm9tIHRoaXMgT2JzZXJ2YWJsZSB0byB0YWtlIHNuYXBzaG90c1xyXG4gICAgdGhpcy50cmlnZ2VyU3Vic2NyaXB0aW9uID0gdHJpZ2dlci5zdWJzY3JpYmUoKCkgPT4ge1xyXG4gICAgICB0aGlzLnRha2VTbmFwc2hvdCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJZiB0aGUgZ2l2ZW4gT2JzZXJ2YWJsZSBlbWl0cywgdGhlIGFjdGl2ZSB3ZWJjYW0gd2lsbCBiZSBzd2l0Y2hlZCB0byB0aGUgb25lIGluZGljYXRlZCBieSB0aGUgZW1pdHRlZCB2YWx1ZS5cclxuICAgKiBAcGFyYW0gc3dpdGNoQ2FtZXJhIEluZGljYXRlcyB3aGljaCB3ZWJjYW0gdG8gc3dpdGNoIHRvXHJcbiAgICogICB0cnVlOiBjeWNsZSBmb3J3YXJkcyB0aHJvdWdoIGF2YWlsYWJsZSB3ZWJjYW1zXHJcbiAgICogICBmYWxzZTogY3ljbGUgYmFja3dhcmRzIHRocm91Z2ggYXZhaWxhYmxlIHdlYmNhbXNcclxuICAgKiAgIHN0cmluZzogYWN0aXZhdGUgdGhlIHdlYmNhbSB3aXRoIHRoZSBnaXZlbiBpZFxyXG4gICAqL1xyXG4gIEBJbnB1dCgpXHJcbiAgcHVibGljIHNldCBzd2l0Y2hDYW1lcmEgKHN3aXRjaENhbWVyYTogT2JzZXJ2YWJsZTxib29sZWFuIHwgc3RyaW5nPikge1xyXG4gICAgaWYgKHRoaXMuc3dpdGNoQ2FtZXJhU3Vic2NyaXB0aW9uKSB7XHJcbiAgICAgIHRoaXMuc3dpdGNoQ2FtZXJhU3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU3Vic2NyaWJlIHRvIGV2ZW50cyBmcm9tIHRoaXMgT2JzZXJ2YWJsZSB0byBzd2l0Y2ggdmlkZW8gZGV2aWNlXHJcbiAgICB0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbiA9IHN3aXRjaENhbWVyYS5zdWJzY3JpYmUoKHZhbHVlOiBib29sZWFuIHwgc3RyaW5nKSA9PiB7XHJcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgLy8gZGV2aWNlSWQgd2FzIHNwZWNpZmllZFxyXG4gICAgICAgIHRoaXMuc3dpdGNoVG9WaWRlb0lucHV0KHZhbHVlKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBkaXJlY3Rpb24gd2FzIHNwZWNpZmllZFxyXG4gICAgICAgIHRoaXMucm90YXRlVmlkZW9JbnB1dCh2YWx1ZSAhPT0gZmFsc2UpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBNZWRpYVRyYWNrQ29uc3RyYWludHMgdG8gcmVxdWVzdCBzdHJlYW1pbmcgdGhlIGdpdmVuIGRldmljZVxyXG4gICAqIEBwYXJhbSBkZXZpY2VJZFxyXG4gICAqIEBwYXJhbSBiYXNlTWVkaWFUcmFja0NvbnN0cmFpbnRzIGJhc2UgY29uc3RyYWludHMgdG8gbWVyZ2UgZGV2aWNlSWQtY29uc3RyYWludCBpbnRvXHJcbiAgICogQHJldHVybnNcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyBnZXRNZWRpYUNvbnN0cmFpbnRzRm9yRGV2aWNlIChkZXZpY2VJZDogc3RyaW5nLCBiYXNlTWVkaWFUcmFja0NvbnN0cmFpbnRzOiBNZWRpYVRyYWNrQ29uc3RyYWludHMpOiBNZWRpYVRyYWNrQ29uc3RyYWludHMge1xyXG4gICAgY29uc3QgcmVzdWx0OiBNZWRpYVRyYWNrQ29uc3RyYWludHMgPSBiYXNlTWVkaWFUcmFja0NvbnN0cmFpbnRzID8gYmFzZU1lZGlhVHJhY2tDb25zdHJhaW50cyA6IHRoaXMuREVGQVVMVF9WSURFT19PUFRJT05TO1xyXG4gICAgaWYgKGRldmljZUlkKSB7XHJcbiAgICAgIHJlc3VsdC5kZXZpY2VJZCA9IHsgZXhhY3Q6IGRldmljZUlkIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRyaWVzIHRvIGhhcnZlc3QgdGhlIGRldmljZUlkIGZyb20gdGhlIGdpdmVuIG1lZGlhU3RyZWFtVHJhY2sgb2JqZWN0LlxyXG4gICAqIEJyb3dzZXJzIHBvcHVsYXRlIHRoaXMgb2JqZWN0IGRpZmZlcmVudGx5OyB0aGlzIG1ldGhvZCB0cmllcyBzb21lIGRpZmZlcmVudCBhcHByb2FjaGVzXHJcbiAgICogdG8gcmVhZCB0aGUgaWQuXHJcbiAgICogQHBhcmFtIG1lZGlhU3RyZWFtVHJhY2tcclxuICAgKiBAcmV0dXJucyBkZXZpY2VJZCBpZiBmb3VuZCBpbiB0aGUgbWVkaWFTdHJlYW1UcmFja1xyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhdGljIGdldERldmljZUlkRnJvbU1lZGlhU3RyZWFtVHJhY2sgKG1lZGlhU3RyZWFtVHJhY2s6IE1lZGlhU3RyZWFtVHJhY2spOiBzdHJpbmcge1xyXG4gICAgaWYgKG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0U2V0dGluZ3MoKS5kZXZpY2VJZCkge1xyXG4gICAgICByZXR1cm4gbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpLmRldmljZUlkO1xyXG4gICAgfSBlbHNlIGlmIChtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzICYmIG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKSAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkuZGV2aWNlSWQpIHtcclxuICAgICAgY29uc3QgZGV2aWNlSWRPYmo6IENvbnN0cmFpbkRPTVN0cmluZyA9IG1lZGlhU3RyZWFtVHJhY2suZ2V0Q29uc3RyYWludHMoKS5kZXZpY2VJZDtcclxuICAgICAgcmV0dXJuIFdlYmNhbUNvbXBvbmVudC5nZXRWYWx1ZUZyb21Db25zdHJhaW5ET01TdHJpbmcoZGV2aWNlSWRPYmopO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVHJpZXMgdG8gaGFydmVzdCB0aGUgZmFjaW5nTW9kZSBmcm9tIHRoZSBnaXZlbiBtZWRpYVN0cmVhbVRyYWNrIG9iamVjdC5cclxuICAgKiBCcm93c2VycyBwb3B1bGF0ZSB0aGlzIG9iamVjdCBkaWZmZXJlbnRseTsgdGhpcyBtZXRob2QgdHJpZXMgc29tZSBkaWZmZXJlbnQgYXBwcm9hY2hlc1xyXG4gICAqIHRvIHJlYWQgdGhlIHZhbHVlLlxyXG4gICAqIEBwYXJhbSBtZWRpYVN0cmVhbVRyYWNrXHJcbiAgICogQHJldHVybnMgZmFjaW5nTW9kZSBpZiBmb3VuZCBpbiB0aGUgbWVkaWFTdHJlYW1UcmFja1xyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhdGljIGdldEZhY2luZ01vZGVGcm9tTWVkaWFTdHJlYW1UcmFjayAobWVkaWFTdHJlYW1UcmFjazogTWVkaWFTdHJlYW1UcmFjayk6IHN0cmluZyB7XHJcbiAgICBpZiAobWVkaWFTdHJlYW1UcmFjaykge1xyXG4gICAgICBpZiAobWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncyAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldFNldHRpbmdzKCkgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpLmZhY2luZ01vZGUpIHtcclxuICAgICAgICByZXR1cm4gbWVkaWFTdHJlYW1UcmFjay5nZXRTZXR0aW5ncygpLmZhY2luZ01vZGU7XHJcbiAgICAgIH0gZWxzZSBpZiAobWVkaWFTdHJlYW1UcmFjay5nZXRDb25zdHJhaW50cyAmJiBtZWRpYVN0cmVhbVRyYWNrLmdldENvbnN0cmFpbnRzKCkgJiYgbWVkaWFTdHJlYW1UcmFjay5nZXRDb25zdHJhaW50cygpLmZhY2luZ01vZGUpIHtcclxuICAgICAgICBjb25zdCBmYWNpbmdNb2RlQ29uc3RyYWludDogQ29uc3RyYWluRE9NU3RyaW5nID0gbWVkaWFTdHJlYW1UcmFjay5nZXRDb25zdHJhaW50cygpLmZhY2luZ01vZGU7XHJcbiAgICAgICAgcmV0dXJuIFdlYmNhbUNvbXBvbmVudC5nZXRWYWx1ZUZyb21Db25zdHJhaW5ET01TdHJpbmcoZmFjaW5nTW9kZUNvbnN0cmFpbnQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGdpdmVuIG1lZGlhU3RyZWFtVHJhY2sgY2xhaW1zIGl0c2VsZiBhcyB1c2VyIGZhY2luZ1xyXG4gICAqIEBwYXJhbSBtZWRpYVN0cmVhbVRyYWNrXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgaXNVc2VyRmFjaW5nIChtZWRpYVN0cmVhbVRyYWNrOiBNZWRpYVN0cmVhbVRyYWNrKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBmYWNpbmdNb2RlOiBzdHJpbmcgPSBXZWJjYW1Db21wb25lbnQuZ2V0RmFjaW5nTW9kZUZyb21NZWRpYVN0cmVhbVRyYWNrKG1lZGlhU3RyZWFtVHJhY2spO1xyXG4gICAgcmV0dXJuIGZhY2luZ01vZGUgPyAndXNlcicgPT09IGZhY2luZ01vZGUudG9Mb3dlckNhc2UoKSA6IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRXh0cmFjdHMgdGhlIHZhbHVlIGZyb20gdGhlIGdpdmVuIENvbnN0cmFpbkRPTVN0cmluZ1xyXG4gICAqIEBwYXJhbSBjb25zdHJhaW5ET01TdHJpbmdcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyBnZXRWYWx1ZUZyb21Db25zdHJhaW5ET01TdHJpbmcgKGNvbnN0cmFpbkRPTVN0cmluZzogQ29uc3RyYWluRE9NU3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmIChjb25zdHJhaW5ET01TdHJpbmcpIHtcclxuICAgICAgaWYgKGNvbnN0cmFpbkRPTVN0cmluZyBpbnN0YW5jZW9mIFN0cmluZykge1xyXG4gICAgICAgIHJldHVybiBTdHJpbmcoY29uc3RyYWluRE9NU3RyaW5nKTtcclxuICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNvbnN0cmFpbkRPTVN0cmluZykgJiYgQXJyYXkoY29uc3RyYWluRE9NU3RyaW5nKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgcmV0dXJuIFN0cmluZyhjb25zdHJhaW5ET01TdHJpbmdbMF0pO1xyXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zdHJhaW5ET01TdHJpbmcgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgaWYgKGNvbnN0cmFpbkRPTVN0cmluZ1snZXhhY3QnXSkge1xyXG4gICAgICAgICAgcmV0dXJuIFN0cmluZyhjb25zdHJhaW5ET01TdHJpbmdbJ2V4YWN0J10pO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWluRE9NU3RyaW5nWydpZGVhbCddKSB7XHJcbiAgICAgICAgICByZXR1cm4gU3RyaW5nKGNvbnN0cmFpbkRPTVN0cmluZ1snaWRlYWwnXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbmdBZnRlclZpZXdJbml0ICgpOiB2b2lkIHtcclxuICAgIHRoaXMuZGV0ZWN0QXZhaWxhYmxlRGV2aWNlcygpXHJcbiAgICAgIC50aGVuKChkZXZpY2VzOiBNZWRpYURldmljZUluZm9bXSkgPT4ge1xyXG4gICAgICAgIC8vIHN0YXJ0IGZpcnN0IGRldmljZVxyXG4gICAgICAgIHRoaXMuc3dpdGNoVG9WaWRlb0lucHV0KGRldmljZXMubGVuZ3RoID4gMCA/IGRldmljZXNbMF0uZGV2aWNlSWQgOiBudWxsKTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKChlcnI6IHN0cmluZykgPT4ge1xyXG4gICAgICAgIHRoaXMuaW5pdEVycm9yLm5leHQoPFdlYmNhbUluaXRFcnJvcj57IG1lc3NhZ2U6IGVyciB9KTtcclxuICAgICAgICAvLyBmYWxsYmFjazogc3RpbGwgdHJ5IHRvIGxvYWQgd2ViY2FtLCBldmVuIGlmIGRldmljZSBlbnVtZXJhdGlvbiBmYWlsZWRcclxuICAgICAgICB0aGlzLnN3aXRjaFRvVmlkZW9JbnB1dChudWxsKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbmdPbkRlc3Ryb3kgKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdG9wTWVkaWFUcmFja3MoKTtcclxuICAgIHRoaXMudW5zdWJzY3JpYmVGcm9tU3Vic2NyaXB0aW9ucygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGFrZXMgYSBzbmFwc2hvdCBvZiB0aGUgY3VycmVudCB3ZWJjYW0ncyB2aWV3IGFuZCBlbWl0cyB0aGUgaW1hZ2UgYXMgYW4gZXZlbnRcclxuICAgKi9cclxuICBwdWJsaWMgdGFrZVNuYXBzaG90ICgpOiB2b2lkIHtcclxuICAgIC8vIHNldCBjYW52YXMgc2l6ZSB0byBhY3R1YWwgdmlkZW8gc2l6ZVxyXG4gICAgY29uc3QgX3ZpZGVvID0gdGhpcy5uYXRpdmVWaWRlb0VsZW1lbnQ7XHJcbiAgICBjb25zdCBkaW1lbnNpb25zID0geyB3aWR0aDogdGhpcy53aWR0aCwgaGVpZ2h0OiB0aGlzLmhlaWdodCB9O1xyXG4gICAgaWYgKF92aWRlby52aWRlb1dpZHRoKSB7XHJcbiAgICAgIGRpbWVuc2lvbnMud2lkdGggPSBfdmlkZW8udmlkZW9XaWR0aDtcclxuICAgICAgZGltZW5zaW9ucy5oZWlnaHQgPSBfdmlkZW8udmlkZW9IZWlnaHQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgX2NhbnZhcyA9IHRoaXMuY2FudmFzLm5hdGl2ZUVsZW1lbnQ7XHJcbiAgICBfY2FudmFzLndpZHRoID0gZGltZW5zaW9ucy53aWR0aDtcclxuICAgIF9jYW52YXMuaGVpZ2h0ID0gZGltZW5zaW9ucy5oZWlnaHQ7XHJcblxyXG4gICAgLy8gcGFpbnQgc25hcHNob3QgaW1hZ2UgdG8gY2FudmFzXHJcbiAgICBjb25zdCBjb250ZXh0MmQgPSBfY2FudmFzLmdldENvbnRleHQoJzJkJyk7XHJcbiAgICBjb250ZXh0MmQuZHJhd0ltYWdlKF92aWRlbywgMCwgMCk7XHJcblxyXG4gICAgLy8gcmVhZCBjYW52YXMgY29udGVudCBhcyBpbWFnZVxyXG4gICAgY29uc3QgbWltZVR5cGU6IHN0cmluZyA9IHRoaXMuaW1hZ2VUeXBlID8gdGhpcy5pbWFnZVR5cGUgOiBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9JTUFHRV9UWVBFO1xyXG4gICAgY29uc3QgcXVhbGl0eTogbnVtYmVyID0gdGhpcy5pbWFnZVF1YWxpdHkgPyB0aGlzLmltYWdlUXVhbGl0eSA6IFdlYmNhbUNvbXBvbmVudC5ERUZBVUxUX0lNQUdFX1FVQUxJVFk7XHJcbiAgICBjb25zdCBkYXRhVXJsOiBzdHJpbmcgPSBfY2FudmFzLnRvRGF0YVVSTChtaW1lVHlwZSwgcXVhbGl0eSk7XHJcblxyXG4gICAgLy8gZ2V0IHRoZSBJbWFnZURhdGEgb2JqZWN0IGZyb20gdGhlIGNhbnZhcycgY29udGV4dC5cclxuICAgIGxldCBpbWFnZURhdGE6IEltYWdlRGF0YSA9IG51bGw7XHJcblxyXG4gICAgaWYgKHRoaXMuY2FwdHVyZUltYWdlRGF0YSkge1xyXG4gICAgICBpbWFnZURhdGEgPSBjb250ZXh0MmQuZ2V0SW1hZ2VEYXRhKDAsIDAsIF9jYW52YXMud2lkdGgsIF9jYW52YXMuaGVpZ2h0KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmltYWdlQ2FwdHVyZS5uZXh0KG5ldyBXZWJjYW1JbWFnZShkYXRhVXJsLCBtaW1lVHlwZSwgaW1hZ2VEYXRhKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTd2l0Y2hlcyB0byB0aGUgbmV4dC9wcmV2aW91cyB2aWRlbyBkZXZpY2VcclxuICAgKiBAcGFyYW0gZm9yd2FyZFxyXG4gICAqL1xyXG4gIHB1YmxpYyByb3RhdGVWaWRlb0lucHV0IChmb3J3YXJkOiBib29sZWFuKSB7XHJcbiAgICBpZiAodGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cyAmJiB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgY29uc3QgaW5jcmVtZW50OiBudW1iZXIgPSBmb3J3YXJkID8gMSA6ICh0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzLmxlbmd0aCAtIDEpO1xyXG4gICAgICBjb25zdCBuZXh0SW5wdXRJbmRleCA9ICh0aGlzLmFjdGl2ZVZpZGVvSW5wdXRJbmRleCArIGluY3JlbWVudCkgJSB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzLmxlbmd0aDtcclxuICAgICAgdGhpcy5zd2l0Y2hUb1ZpZGVvSW5wdXQodGhpcy5hdmFpbGFibGVWaWRlb0lucHV0c1tuZXh0SW5wdXRJbmRleF0uZGV2aWNlSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3dpdGNoZXMgdGhlIGNhbWVyYS12aWV3IHRvIHRoZSBzcGVjaWZpZWQgdmlkZW8gZGV2aWNlXHJcbiAgICovXHJcbiAgcHVibGljIHN3aXRjaFRvVmlkZW9JbnB1dCAoZGV2aWNlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy52aWRlb0luaXRpYWxpemVkID0gZmFsc2U7XHJcbiAgICB0aGlzLnN0b3BNZWRpYVRyYWNrcygpO1xyXG4gICAgdGhpcy5pbml0V2ViY2FtKGRldmljZUlkLCB0aGlzLnZpZGVvT3B0aW9ucyk7XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogRXZlbnQtaGFuZGxlciBmb3IgdmlkZW8gcmVzaXplIGV2ZW50LlxyXG4gICAqIFRyaWdnZXJzIEFuZ3VsYXIgY2hhbmdlIGRldGVjdGlvbiBzbyB0aGF0IG5ldyB2aWRlbyBkaW1lbnNpb25zIGdldCBhcHBsaWVkXHJcbiAgICovXHJcbiAgcHVibGljIHZpZGVvUmVzaXplICgpOiB2b2lkIHtcclxuICAgIC8vIGhlcmUgdG8gdHJpZ2dlciBBbmd1bGFyIGNoYW5nZSBkZXRlY3Rpb25cclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdmlkZW9XaWR0aCAoKSB7XHJcbiAgICBjb25zdCB2aWRlb1JhdGlvID0gdGhpcy5nZXRWaWRlb0FzcGVjdFJhdGlvKCk7XHJcbiAgICByZXR1cm4gTWF0aC5taW4odGhpcy53aWR0aCwgdGhpcy5oZWlnaHQgKiB2aWRlb1JhdGlvKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdmlkZW9IZWlnaHQgKCkge1xyXG4gICAgY29uc3QgdmlkZW9SYXRpbyA9IHRoaXMuZ2V0VmlkZW9Bc3BlY3RSYXRpbygpO1xyXG4gICAgcmV0dXJuIE1hdGgubWluKHRoaXMuaGVpZ2h0LCB0aGlzLndpZHRoIC8gdmlkZW9SYXRpbyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHZpZGVvU3R5bGVDbGFzc2VzICgpIHtcclxuICAgIGxldCBjbGFzc2VzOiBzdHJpbmcgPSAnJztcclxuXHJcbiAgICBpZiAodGhpcy5pc01pcnJvckltYWdlKCkpIHtcclxuICAgICAgY2xhc3NlcyArPSAnbWlycm9yZWQgJztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gY2xhc3Nlcy50cmltKCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG5hdGl2ZVZpZGVvRWxlbWVudCAoKSB7XHJcbiAgICByZXR1cm4gdGhpcy52aWRlby5uYXRpdmVFbGVtZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgdmlkZW8gYXNwZWN0IHJhdGlvIG9mIHRoZSBhY3RpdmUgdmlkZW8gc3RyZWFtXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRWaWRlb0FzcGVjdFJhdGlvICgpOiBudW1iZXIge1xyXG4gICAgLy8gY2FsY3VsYXRlIHJhdGlvIGZyb20gdmlkZW8gZWxlbWVudCBkaW1lbnNpb25zIGlmIHByZXNlbnRcclxuICAgIGNvbnN0IHZpZGVvRWxlbWVudCA9IHRoaXMubmF0aXZlVmlkZW9FbGVtZW50O1xyXG4gICAgaWYgKHZpZGVvRWxlbWVudC52aWRlb1dpZHRoICYmIHZpZGVvRWxlbWVudC52aWRlb1dpZHRoID4gMCAmJlxyXG4gICAgICB2aWRlb0VsZW1lbnQudmlkZW9IZWlnaHQgJiYgdmlkZW9FbGVtZW50LnZpZGVvSGVpZ2h0ID4gMCkge1xyXG5cclxuICAgICAgcmV0dXJuIHZpZGVvRWxlbWVudC52aWRlb1dpZHRoIC8gdmlkZW9FbGVtZW50LnZpZGVvSGVpZ2h0O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIG5vdGhpbmcgcHJlc2VudCAtIGNhbGN1bGF0ZSByYXRpbyBiYXNlZCBvbiB3aWR0aC9oZWlnaHQgcGFyYW1zXHJcbiAgICByZXR1cm4gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdCB3ZWJjYW0gbGl2ZSB2aWV3XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBpbml0V2ViY2FtIChkZXZpY2VJZDogc3RyaW5nLCB1c2VyVmlkZW9UcmFja0NvbnN0cmFpbnRzOiBNZWRpYVRyYWNrQ29uc3RyYWludHMpIHtcclxuICAgIGNvbnN0IF92aWRlbyA9IHRoaXMubmF0aXZlVmlkZW9FbGVtZW50O1xyXG4gICAgaWYgKG5hdmlnYXRvci5tZWRpYURldmljZXMgJiYgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEpIHtcclxuXHJcbiAgICAgIC8vIG1lcmdlIGRldmljZUlkIC0+IHVzZXJWaWRlb1RyYWNrQ29uc3RyYWludHNcclxuICAgICAgbGV0IHZpZGVvVHJhY2tDb25zdHJhaW50cztcclxuICAgICAgaWYgKHRoaXMuZmlyc3RUaW1lTG9hZClcclxuICAgICAgICB2aWRlb1RyYWNrQ29uc3RyYWludHMgPSBXZWJjYW1Db21wb25lbnQuZ2V0TWVkaWFDb25zdHJhaW50c0ZvckRldmljZShkZXZpY2VJZCwgdXNlclZpZGVvVHJhY2tDb25zdHJhaW50cyk7XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZmlyc3RUaW1lTG9hZCA9IHRydWVcclxuICAgICAgICB2aWRlb1RyYWNrQ29uc3RyYWludHMgPSBXZWJjYW1Db21wb25lbnQuREVGQVVMVF9WSURFT19PUFRJT05TO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSg8TWVkaWFTdHJlYW1Db25zdHJhaW50cz57IHZpZGVvOiB2aWRlb1RyYWNrQ29uc3RyYWludHMgfSlcclxuICAgICAgICAudGhlbigoc3RyZWFtOiBNZWRpYVN0cmVhbSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5tZWRpYVN0cmVhbSA9IHN0cmVhbTtcclxuICAgICAgICAgIF92aWRlby5zcmNPYmplY3QgPSBzdHJlYW07XHJcbiAgICAgICAgICBfdmlkZW8ucGxheSgpO1xyXG5cclxuICAgICAgICAgIHRoaXMuYWN0aXZlVmlkZW9TZXR0aW5ncyA9IHN0cmVhbS5nZXRWaWRlb1RyYWNrcygpWzBdLmdldFNldHRpbmdzKCk7XHJcbiAgICAgICAgICBjb25zdCBhY3RpdmVEZXZpY2VJZDogc3RyaW5nID0gV2ViY2FtQ29tcG9uZW50LmdldERldmljZUlkRnJvbU1lZGlhU3RyZWFtVHJhY2soc3RyZWFtLmdldFZpZGVvVHJhY2tzKClbMF0pO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVWaWRlb0lucHV0SW5kZXggPSBhY3RpdmVEZXZpY2VJZCA/IHRoaXMuYXZhaWxhYmxlVmlkZW9JbnB1dHNcclxuICAgICAgICAgICAgLmZpbmRJbmRleCgobWVkaWFEZXZpY2VJbmZvOiBNZWRpYURldmljZUluZm8pID0+IG1lZGlhRGV2aWNlSW5mby5kZXZpY2VJZCA9PT0gYWN0aXZlRGV2aWNlSWQpIDogLTE7XHJcbiAgICAgICAgICB0aGlzLnZpZGVvSW5pdGlhbGl6ZWQgPSB0cnVlO1xyXG5cclxuICAgICAgICAgIHRoaXMuY2FtZXJhU3dpdGNoZWQubmV4dChhY3RpdmVEZXZpY2VJZCk7XHJcblxyXG4gICAgICAgICAgLy8gSW5pdGlhbCBkZXRlY3QgbWF5IHJ1biBiZWZvcmUgdXNlciBnYXZlIHBlcm1pc3Npb25zLCByZXR1cm5pbmcgbm8gZGV2aWNlSWRzLiBUaGlzIHByZXZlbnRzIGxhdGVyIGNhbWVyYSBzd2l0Y2hlcy4gKCM0NylcclxuICAgICAgICAgIC8vIFJ1biBkZXRlY3Qgb25jZSBhZ2FpbiB3aXRoaW4gZ2V0VXNlck1lZGlhIGNhbGxiYWNrLCB0byBtYWtlIHN1cmUgdGhpcyB0aW1lIHdlIGhhdmUgcGVybWlzc2lvbnMgYW5kIGdldCBkZXZpY2VJZHMuXHJcbiAgICAgICAgICB0aGlzLmRldGVjdEF2YWlsYWJsZURldmljZXMoKTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5jYXRjaCgoZXJyOiBNZWRpYVN0cmVhbUVycm9yKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmluaXRFcnJvci5uZXh0KDxXZWJjYW1Jbml0RXJyb3I+eyBtZXNzYWdlOiBlcnIubWVzc2FnZSwgbWVkaWFTdHJlYW1FcnJvcjogZXJyIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5pbml0RXJyb3IubmV4dCg8V2ViY2FtSW5pdEVycm9yPnsgbWVzc2FnZTogJ0Nhbm5vdCByZWFkIFVzZXJNZWRpYSBmcm9tIE1lZGlhRGV2aWNlcy4nIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRBY3RpdmVWaWRlb1RyYWNrICgpOiBNZWRpYVN0cmVhbVRyYWNrIHtcclxuICAgIHJldHVybiB0aGlzLm1lZGlhU3RyZWFtID8gdGhpcy5tZWRpYVN0cmVhbS5nZXRWaWRlb1RyYWNrcygpWzBdIDogbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNNaXJyb3JJbWFnZSAoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoIXRoaXMuZ2V0QWN0aXZlVmlkZW9UcmFjaygpKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBjaGVjayBmb3IgZXhwbGljaXQgbWlycm9yIG92ZXJyaWRlIHBhcmFtZXRlclxyXG4gICAge1xyXG4gICAgICBsZXQgbWlycm9yOiBzdHJpbmcgPSAnYXV0byc7XHJcbiAgICAgIGlmICh0aGlzLm1pcnJvckltYWdlKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm1pcnJvckltYWdlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgbWlycm9yID0gU3RyaW5nKHRoaXMubWlycm9ySW1hZ2UpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIC8vIFdlYmNhbU1pcnJvclByb3BlcnRpZXNcclxuICAgICAgICAgIGlmICh0aGlzLm1pcnJvckltYWdlLngpIHtcclxuICAgICAgICAgICAgbWlycm9yID0gdGhpcy5taXJyb3JJbWFnZS54LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBzd2l0Y2ggKG1pcnJvcikge1xyXG4gICAgICAgIGNhc2UgJ2Fsd2F5cyc6XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBjYXNlICduZXZlcic6XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBkZWZhdWx0OiBlbmFibGUgbWlycm9yaW5nIGlmIHdlYmNhbSBpcyB1c2VyIGZhY2luZ1xyXG4gICAgcmV0dXJuIFdlYmNhbUNvbXBvbmVudC5pc1VzZXJGYWNpbmcodGhpcy5nZXRBY3RpdmVWaWRlb1RyYWNrKCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcHMgYWxsIGFjdGl2ZSBtZWRpYSB0cmFja3MuXHJcbiAgICogVGhpcyBwcmV2ZW50cyB0aGUgd2ViY2FtIGZyb20gYmVpbmcgaW5kaWNhdGVkIGFzIGFjdGl2ZSxcclxuICAgKiBldmVuIGlmIGl0IGlzIG5vIGxvbmdlciB1c2VkIGJ5IHRoaXMgY29tcG9uZW50LlxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RvcE1lZGlhVHJhY2tzICgpIHtcclxuICAgIGlmICh0aGlzLm1lZGlhU3RyZWFtICYmIHRoaXMubWVkaWFTdHJlYW0uZ2V0VHJhY2tzKSB7XHJcbiAgICAgIC8vIGdldFRyYWNrcygpIHJldHVybnMgYWxsIG1lZGlhIHRyYWNrcyAodmlkZW8rYXVkaW8pXHJcbiAgICAgIHRoaXMubWVkaWFTdHJlYW0uZ2V0VHJhY2tzKClcclxuICAgICAgICAuZm9yRWFjaCgodHJhY2s6IE1lZGlhU3RyZWFtVHJhY2spID0+IHRyYWNrLnN0b3AoKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnN1YnNjcmliZSBmcm9tIGFsbCBvcGVuIHN1YnNjcmlwdGlvbnNcclxuICAgKi9cclxuICBwcml2YXRlIHVuc3Vic2NyaWJlRnJvbVN1YnNjcmlwdGlvbnMgKCkge1xyXG4gICAgaWYgKHRoaXMudHJpZ2dlclN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnRyaWdnZXJTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbikge1xyXG4gICAgICB0aGlzLnN3aXRjaENhbWVyYVN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhZHMgYXZhaWxhYmxlIGlucHV0IGRldmljZXNcclxuICAgKi9cclxuICBwcml2YXRlIGRldGVjdEF2YWlsYWJsZURldmljZXMgKCk6IFByb21pc2U8TWVkaWFEZXZpY2VJbmZvW10+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIFdlYmNhbVV0aWwuZ2V0QXZhaWxhYmxlVmlkZW9JbnB1dHMoKVxyXG4gICAgICAgIC50aGVuKChkZXZpY2VzOiBNZWRpYURldmljZUluZm9bXSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5hdmFpbGFibGVWaWRlb0lucHV0cyA9IGRldmljZXM7XHJcbiAgICAgICAgICByZXNvbHZlKGRldmljZXMpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgICB0aGlzLmF2YWlsYWJsZVZpZGVvSW5wdXRzID0gW107XHJcbiAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbn1cclxuIl19