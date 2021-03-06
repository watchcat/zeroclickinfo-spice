nrj("soundmanager2/script/soundmanager2-nodebug-jsmin.js", 1);

(function(env) {
    "use strict"

    var SOUNDCLOUD_CLIENT_ID = 'df14a65559c0e555d9f9fd950c2d5b17',
        script = $('[src*="/js/spice/sound_cloud/"]')[0],
        source = $(script).attr("src"),
        query = source.match(/sound_cloud\/([^\/]*)/)[1],

        // Blacklist some adult results.
        skip_ids = {
            80320921: 1, 
            75349402: 1
        };

    // global SM var:
    window.SM2_DEFER = true;

    /**
     * Tile Audio player
     *
     * I kept this separate from the spice and self contained so
     * we could potentially refactor it out at some point.
     *
     * If we create another spice with
     * playable audio tiles, we're probably going to want a
     * single controller to manage audio playback
     * across tabs/spices.
     */
    var player = {
        // flipped to 1 on ready:
        _ready: 0,

        init: function() {
            var self = this;

            // don't init more than once:
            if (window.soundManager || this._ready) { return; }

            // make sure the lib is loaded and in memory,
            // otherwise poll for it until it is:
            if (!window["SoundManager"]) { 
                return setTimeout(this.init.bind(this),50);
            }

            window.soundManager = new SoundManager();
            soundManager.url = "/soundmanager2/swf";
            soundManager.flashVersion = 9;
            soundManager.useFlashBlock = false;
            soundManager.useHTML5Audio = true;
            //soundManager.onerror(function(){
            //    console.log("error loading soundmanager",arguments);
            //});
            soundManager.ontimeout(function(){
                console.log("timeout loading soundmanager",arguments);
            });
            soundManager.beginDelayedInit();
            soundManager.onready(function() {
                self._ready = 1;
            });
        },

        play: function(item) {
            if (!this._ready) { return; }

            // if a different item is playing, stop it:
            if (this._curItem && this._curItem.id !== item.id) {
                this.stop();
            }

            if (item.sound) {
                item.sound.play();
            } else {
                item.$action = item.$html.find('.audio-controls__action');
                item.$time = item.$html.find('.audio-controls__time');
                item.$progress = item.$html.find('.audio-controls__progress');
                item.$loadProgress = item.$html.find('.audio-controls__progress-loading');
                item.$loadProgressFill = item.$html.find('.audio-controls__progress-loading .rotated-fill');
                item.$playProgress = item.$html.find('.audio-controls__progress-playback');
                item.$playProgressFill = item.$html.find('.audio-controls__progress-playback .rotated-fill');

                item.sound = soundManager.createSound({
                    id: item.id,
                    url: item.streamURL,
                    autoPlay: true,
                    whileloading: this._onLoadProgress.bind(this,item),
                    whileplaying: this._onPlayProgress.bind(this,item),
                    onload: this._onLoadFinished.bind(this,item),
                    onfinish: this._onPlayFinished.bind(this,item)
                });
            }

            item.$html.removeClass('is-paused');
            item.$action.text('║');

            // update the UI

            this._curItem = item;
        },

        pause: function(item) {
            if (!this._ready) { return; }

            if (this._curItem && item && this._curItem.id === item.id && item.sound) {
                item.sound.pause();
                item.$html.addClass('is-paused');
                item.$action.text('►');
            }

            // update the UI
        },

        stop: function() {
            if (!this._ready) { return; }

            soundManager.stopAll();

            if (this._curItem) {
                // update the UI
                this._curItem.$html.removeClass('is-paused');
                this._curItem.$action.text('►');

                // don't want to clear the 'Stream Unavailable text, only the -0:00 time:
                if (!this._curItem.$html.hasClass('is-unavailable')) {
                    this._curItem.$time.text('');
                }
                this._curItem.$loadProgress.removeClass('gt50');
                this._curItem.$playProgress.removeClass('gt50');
                this._updateProgress(this._curItem.$loadProgressFill,0);
                this._updateProgress(this._curItem.$playProgressFill,0);

                // free up resources:
                this._curItem.sound.destruct();
                delete this._curItem.sound
                delete this._curItem;
            }
        },

        _updateProgress: function(elem,pct) {
            var deg = (360 / 100 * pct) + 'deg';

            elem.css({
                '-moz-transform': 'rotate(' + deg + ')',
                '-webkit-transform': 'rotate(' + deg + ')',
                '-o-transform': 'rotate(' + deg + ')',
                'transform': 'rotate(' + deg + ')'
            });
        },

        _onLoadProgress: function(item) {
            if (!item || !item.sound || !item.$loadProgress) { return; }

            var pctLoaded = (item.sound.bytesLoaded / item.sound.bytesTotal) * 100;

            // hacking for now fill to 100 after 50%,
            // not sure how to handle
            // the circle with opacity
            if (pctLoaded > 50) {
                item.$loadProgress.addClass('gt50');
                return this._updateProgress(item.$loadProgressFill, 100);
            }

            this._updateProgress(item.$loadProgressFill, pctLoaded);
        },

        _onLoadFinished: function(item, success) {
            if (success || !item || !item.$time || !item.$html) { return; }

            // handle load error:
            item.$time.text('Stream Unavailable');
            item.$html.addClass('is-unavailable');

            this.stop();

            if (this._autoplaying) {
                Spice.selectNextItem('soundcloud');
            }
        },

        _onPlayProgress: function(item) {
            if (!item || !item.sound || !item.$time || !item.duration) { return; }

            var msLeft = item.duration - item.sound.position,
                pctPlayed = (item.sound.position / item.duration) * 100;

            // update text label:
            item.$time.text( '-' + DDG.formatDuration(msLeft));

            if (pctPlayed > 50) {
                item.$playProgress.addClass('gt50');
            }

            this._updateProgress(item.$playProgressFill, pctPlayed);
        },

        _onPlayFinished: function(item) {
            this.stop();
            this._autoplaying = 1;
            Spice.selectNextItem('soundcloud');
        }
    };

    env.ddg_spice_sound_cloud = function(api_result) {

        if(!api_result){
            return Spice.failed("sound_cloud");
        }

        Spice.add({
            id: 'soundcloud',
            name: 'Audio',
            data: api_result,
            meta: {
                sourceName: 'SoundCloud',
                sourceUrl: 'https://soundcloud.com/search?q=' + query,
                sourceIcon: true,
                itemType: 'Tracks'
            },
            templates: {
                item_custom: Spice.sound_cloud.item
            },
            normalize: function(o) {

                var resultThreshold = 4;

                // skip items with a low favorite count
                if(o.favoritings_count < resultThreshold){
                    return;
                }

                var image = o.artwork_url || o.user.avatar_url,
                    usingWaveformImage = 0;

                // Check if it's using the default avatar, if
                // so switch to waveform and set the flag
                if (/default_avatar_large/.test(image)) {
                    image = o.waveform_url;
                    usingWaveformImage = 1;
                } else {
                    // Get the larger image for our IA.
                    image = image.replace(/large\.jpg/, "t200x200.jpg");
                }

                // skip items that can't be streamed or explicit id's we
                // want to skip for adult content:
                if (!o.stream_url || skip_ids[o.id]) {
                    return;
                }

                var streamURL = '/audio?u=' + o.stream_url + '?client_id=' + SOUNDCLOUD_CLIENT_ID;

                return {
                    image: image,
                    usingWaveformImage: usingWaveformImage,
                    hearts: o.favoritings_count || 0,
                    duration: o.duration,
                    link: o.permalink_url,
                    title: o.title,
                    streamURL: streamURL
                };
            },
            onItemSelected: function(item) {
                player.play(item);
            },
            onItemUnselected: function(item) {
                player.pause(item);
            },
            onShow: function() {
                player.init();
            },
            onHide: function() {
                // could kill the player here, not sure, kind
                // of nice that it still plays while you flip to other tabs?
            }
        });
    };
}(this));
