function addListener(target, type, handler) {
		if(target.addEventListener){
			target.addEventListener(type, handler, false);
		} else if(target.attachEvent) {
			target.attachEvent("on" + type, handler);
		} else {
			target["on" + type] = handler;
		}
	}
	addListener(window, 'load', eventWindowLoaded);	

	function eventWindowLoaded() {
		slotGameApp();
	}
	
	function slotGameApp() {
		if(!Modernizr.canvas) {
			alert("Slot machine game is not supported on this browser. Please use IE 9.0, Chrome or Firefox");
			return;
		}
		
		//setup
		(function() {	
			var theCanvas = document.getElementById("canvas"), 
				context = theCanvas.getContext("2d");	
	
			theCanvas.width = window.innerWidth || document.body.clientWidth;
			theCanvas.height = window.innerHeight || document.body.clientHeight;
			theCanvas.width -= 10;
			theCanvas.height -= 10;
						
			var APP = {};
			APP.reelMargin = 10;
			APP.reelWidth = 270;
			APP.reelHeight = 600;
			APP.pieceWidth = 250;
			APP.pieceHeight = 300;
			APP.indicatorHeight = 20;
			APP.canvasOffsetLeft = 0;
			APP.canvasOffsetTop = 0;
			APP.yshift = 50;
			APP.frameRate = 60;
			APP.refreshInterval = 1000/APP.frameRate;
			APP.spinsToGrandPrize = 15;

			function Sprite() {}
			Sprite.prototype.x = 0;
			Sprite.prototype.y = 0;
			Sprite.prototype.width = 0;
			Sprite.prototype.height = 0;
			Sprite.prototype.draw = function(context) {
				throw new Error("Not Implemented");
			}; 

			function GameStage() {}
			GameStage.prototype = new Sprite();
			GameStage.prototype.__proto__ = Sprite.prototype;
			GameStage.prototype.reels = [];
			GameStage.prototype.indicators = [];
			GameStage.prototype.draw = function(context) {
				context.fillStyle = '#000000';
				context.fillRect(0,0, this.width, this.height);
			
				var gradient = context.createLinearGradient(0, this.y, 0, this.y + this.height);
				gradient.addColorStop(0,'rgb(25,230,25)');
				gradient.addColorStop(0.25,'rgb(50,230,50)');
				gradient.addColorStop(.5,'rgb(50,80,50)');
				gradient.addColorStop(0.75,'rgb(50,230,50)');
				gradient.addColorStop(1,'rgb(25,230,25)');
			
				context.fillStyle = gradient;
				context.fillRect(this.x, this.y, this.width, this.height);
			
				var i = 0, 
					len = this.indicators.length;
				for (; i < len;) {
					this.indicators[i++].draw(context);
				}
				
				i = 0;
				len = this.reels.length;
				for (; i < len;) {
					this.reels[i++].draw(context);
				}
			};

			function GameIndicator() {}
			GameIndicator.prototype = new Sprite();
			GameIndicator.prototype.__proto__ = Sprite.prototype;
			GameIndicator.prototype.x2 = function() { return this.isPointingRight? (this.x + this.width) : (this.x - this.width); };
			GameIndicator.prototype.y2 = function() { return this.y + this.height/2; };
			GameIndicator.prototype.x3 = function() { return this.x; };
			GameIndicator.prototype.y3 = function() { return this.y + this.height; };
			GameIndicator.prototype.isPointingRight = true;
			GameIndicator.prototype.draw = function(context) {
				context.fillStyle = '#ffffff';
				context.beginPath();
				context.moveTo(this.x, this.y);
				context.lineTo(this.x2(), this.y2());
				context.lineTo(this.x3(), this.y3());
				context.lineTo(this.x, this.y);
				context.fill();
				context.closePath();
			};

			function GameReel() {}
			GameReel.prototype = new Sprite();
			GameReel.prototype.__proto__ = Sprite.prototype;
			GameReel.prototype.pieces = [];
			GameReel.prototype.indexOfAnyNonGrandPrizePiece = function() {
				var i = 0, 
					len = this.pieces.length, 
					indexOfGrandPrizePiece = this.indexOfGrandPrizePiece(),
					indexesOfNonGrandPrize = [];
				for (; i < len; i++) {
					if (!this.pieces[i].isGrandPrize) {
						indexesOfNonGrandPrize.push(i);
					}
				}
				return indexesOfNonGrandPrize[Math.floor(Math.random()*indexesOfNonGrandPrize.length)]; 
			};

			GameReel.prototype.draw = function(context) {
				var gr = context.createLinearGradient(0, this.y, 0, this.y + this.height);
					gr.addColorStop(0,'rgb(50,50,50)');
					gr.addColorStop(.5,'rgb(255,255,255)');
					gr.addColorStop(1,'rgb(50,50,50)');
					context.fillStyle = gr;
					context.fillRect(this.x, this.y, this.width, this.height);
					this.drawPieces(context);
			};

			GameReel.prototype.drawPieces = function(context) {
				var i = 0,
					len = this.pieces.length;
				for(; i < len;) {
					this.pieces[i++].draw(context);
				}	
			}

			GameReel.prototype.movePieces = function(amount, lo, hi) {
				var i = 0,
					len = this.pieces.length;
				for (; i < len;) {
					this.pieces[i++].move(amount, lo, hi);
				}
 			}

			GameReel.prototype.indexOfGrandPrizePiece = function() {
				var i = 0, len = this.pieces.length, index = -1;
				for (; i < len; i++) {
					if (this.pieces[i].isGrandPrize) {
						index = i;
						break;
					}
				}
				return index;
			};

			function GamePiece() {}
			GamePiece.prototype = new Sprite();
			GamePiece.prototype.__proto__ = Sprite.prototype;
			GamePiece.prototype.dx = 0;			
			GamePiece.prototype.dy = 0;
			GamePiece.prototype.image = null;
			GamePiece.prototype.isGrandPrize = false;
			GamePiece.prototype.reel = null;

			GamePiece.prototype.draw = function (context) {

				if (!this.image || !this.reel) return;

				var minY = this.y + this.dy,
					maxY = minY + this.height,
					reelMinY = this.reel.y,
					reelMaxY = this.reel.y + this.reel.height;

				if ( maxY <= reelMinY || minY >= reelMaxY) { //outside reel
					return; //no op
				} else if ( minY < reelMinY){ //piece is transitioning onto reel
					var visibleHeight = maxY - reelMinY;
					context.drawImage(this.image, 0, (this.height - visibleHeight), this.width, visibleHeight,
										this.x, reelMinY, this.width, visibleHeight); 

				} else if ( maxY > reelMaxY ) { //piece is transitioning off reel
					var visibleHeight = this.height - (maxY - reelMaxY);
					context.drawImage(this.image, 0, 0, this.width, visibleHeight, 
										this.x, minY, this.width, visibleHeight);

				} else {
					context.drawImage(this.image, this.x, minY, this.width, this.height);
				}
			};

			GamePiece.prototype.move = function (amount, lo, hi) {
				this.dy += amount;
				if( (this.y + this.dy) > hi) { 
					this.dy = (this.y + this.dy) - hi;
					this.y = lo;
				}
			};

			function ReelAnimation() {
				if (arguments.length == 0) {
					throw new Error("Missing animation parameter map");
				}

				var params = arguments[0];
				this.isJackpot = params["isJackpot"];
				this.endTime = params["duration"];
				this.reel = params["reel"];
				this.stopIndex = this.isJackpot? this.reel.indexOfGrandPrizePiece(): this.reel.indexOfAnyNonGrandPrizePiece();
				this.stopY = params["stopY"];
				this.refreshInterval = params["refreshInterval"];
				this.lo = params["lo"];
				this.hi = params["hi"];
				this.context = params["context"];
				this.verticalShift = params["verticalShift"];
			}

			ReelAnimation.prototype.isJackpot = false;
			ReelAnimation.prototype.stopIndex = -1;
			ReelAnimation.prototype.stopY = 0;
			ReelAnimation.prototype.elapsedTime = 0;
			ReelAnimation.prototype.endTime = 0;
			ReelAnimation.prototype.ended = false;
			ReelAnimation.prototype.reel = null;
			ReelAnimation.prototype.refreshInterval = 0;
			ReelAnimation.prototype.verticalShift = 0;
			ReelAnimation.prototype.lo = 0;
			ReelAnimation.prototype.hi = 0;
			ReelAnimation.prototype.context = null;
			ReelAnimation.prototype.tick = function() {
				if(this.ended == true) return;

				var piece = this.reel.pieces[this.stopIndex], 
					deviation = this.stopY - (piece.y + piece.dy),
					withinBounds = (Math.abs(deviation) <= this.verticalShift);
					
				if (this.elapsedTime >= this.endTime &&  withinBounds) {
					this.reel.movePieces(deviation, this.lo, this.hi);
					this.ended = true;
				
				} else {
					this.reel.movePieces(this.verticalShift, this.lo, this.hi);
					this.elapsedTime += this.refreshInterval;
				}

				this.reel.draw(this.context);
			};

			var itemsToLoad = 7;
			var loadCount = 0;
			var itemLoaded = function() {
				
				loadCount++;
				if(loadCount >= itemsToLoad) {
					//completed loading

					var configurations = 
						[[image2, image1, image3, image4, image5]
						,[image1, image2, image4, image5, image3]
						,[image2, image5, image3, image4, image1]],

						numSpins = 0,
						spinEnabled = true,
						numReels = configurations.length,
						reelX = (theCanvas.width - (numReels*APP.reelWidth + (numReels-1)*APP.reelMargin))/2, 
						reelY = (theCanvas.height - APP.reelHeight)/2,
						pieceMinY = reelY - 1.5*APP.pieceHeight,
						pieceMaxY = pieceMinY + 5*APP.pieceHeight,
						pieceInitialY = pieceMinY,
						pieceMargin = (APP.reelWidth - APP.pieceWidth)/2; 
						pieceMinX = reelX + pieceMargin;
						pieceInitialX = pieceMinX,
						piece = null,
						reel = null,
						stage = null,
						pieces = null,
						config = null,
						leftIndicator = null,
						rightIndicator = null,
						reels = [],
						i = 0,
						j = 0;

					stage = new GameStage();
					stage.x = reelX - APP.reelMargin;
					stage.y = reelY - APP.reelMargin;
					stage.height = APP.reelHeight + 2*APP.reelMargin;
					stage.width = APP.reelWidth * numReels + APP.reelMargin * (numReels+1);

					leftIndicator = new GameIndicator();
					leftIndicator.height = APP.indicatorHeight;
					leftIndicator.width = APP.reelMargin;
					leftIndicator.x = reelX - APP.reelMargin;
					leftIndicator.y = reelY + (APP.reelHeight - APP.indicatorHeight)/2;
					leftIndicator.isPointingRight = true;

					rightIndicator = new GameIndicator();
					rightIndicator.height = APP.indicatorHeight;
					rightIndicator.width = APP.reelMargin;
					rightIndicator.x = reelX + numReels*(APP.reelWidth + APP.reelMargin);
					rightIndicator.y = reelY + (APP.reelHeight - APP.indicatorHeight)/2;
					rightIndicator.isPointingRight = false;

					stage.indicators = [leftIndicator, rightIndicator];

					for (; i < numReels; i++) {
						config = configurations[i];
						pieces = [];

						reel = new GameReel();
						reel.x = reelX;
						reel.y = reelY;
						reel.width = APP.reelWidth;
						reel.height = APP.reelHeight;

						j = 0;
						for (; j < config.length; j++) {
							piece = new GamePiece();
							piece.x = pieceInitialX;
							piece.y = pieceInitialY;
							piece.width = APP.pieceWidth;
							piece.height = APP.pieceHeight;
							piece.image = config[j];
							piece.isGrandPrize = (piece.image == image1);
							piece.reel = reel;
							pieces.push(piece);

							pieceInitialY += APP.pieceHeight;
						}

						reel.pieces = pieces;
						reels.push(reel);

						pieceInitialY = pieceMinY;
						reelX += (APP.reelWidth + APP.reelMargin);
						pieceInitialX = reelX + pieceMargin;  
					}

					stage.reels = reels;
					stage.draw(context);
					
					///////////////////////// event handler /////////////////////////	

					
					addListener(theCanvas, "click", canvasClicked);
					function canvasClicked(e) {
						if(spinEnabled == true) {
							spinEnabled = false;
							spin();
						}
						
						function spin(){
							audioElement2.currentTime = 0;
							audioElement2.pause();
							
							audioElement1.play();
							
							var reelStopY = reelY + 0.5 * APP.pieceHeight,
								isJackpot = false;		

							if (numSpins < APP.spinsToGrandPrize) {
								numSpins++;
								isJackpot = false;
								
							
							} else {
								numSpins = 0;
								isJackpot = true;
								
							}
							
							var props = {};
							props.isJackpot = isJackpot;
							props.stopY = reelStopY;
							props.verticalShift = APP.yshift;
							props.lo = pieceMinY;
							props.hi = pieceMaxY;
							props.refreshInterval = APP.refreshInterval;
							props.context = context;

							var mergeProps = function(obj1, obj2) {
								var result = {};
								for (var prop in obj1) {
									if (obj1.hasOwnProperty(prop)) {
										result[prop] = obj1[prop];
									}
								}
								for (var prop in obj2) {
									if (obj2.hasOwnProperty(prop)) {
										result[prop] = obj2[prop];
									}
								}
								return result;
							},
							reduce = function reduce(arr, callback, accumulator) {
								if (!arr || arr.length == 0) 
									return accumulator;
								accumulator = callback(arr[0], accumulator);
								return reduce(arr.slice(1), callback, accumulator);
							},
							each = function each(arr, callback) {
								if (!arr || arr.length == 0)
									return;
								callback(arr[0]);
								each(arr.slice(1), callback);
							};

							reelAnimations = [],
							i = 0,
							len = stage.reels.length,
							duration = 1000;
							for (; i < len; i++) {
								reelAnimations.push(new ReelAnimation(mergeProps({"reel":stage.reels[i], "duration":duration}, props)));
								duration += 200;
							}

							console.log(reelAnimations[0]);

							var handleId = setInterval(
								(function() {
									var allEnded = true;
									allEnded = reduce(reelAnimations, function(el, accumulator){
										accumulator = accumulator && el.ended;
										return accumulator;
									}, allEnded);

									if(allEnded && audioElement1.ended) {
										clearInterval(handleId);
										
										audioElement1.currentTime = 0;
										audioElement1.pause();
										
										var result = {};
										result.previousPiece = null;
										result.allMatches = true;

										result = reduce(reelAnimations, function(el, accumulator){
											var piece = el.reel.pieces[el.stopIndex];
											if (result.previousPiece) {
												result.allMatches = result.allMatches && (result.previousPiece.image == piece.image);	
											}
											result.previousPiece = piece;
											return result;
										}, result);

										if (result.allMatches && isJackpot) {
											audioElement2.play();										
										}

										spinEnabled = true;
										
									} else {
										each(reelAnimations, function(el) {
											el.tick();
										});
									}
								})
							, APP.refreshInterval);
						}
					}
				}
			}
			
			function supportedAudioFormat() {
				if(Modernizr.audio.wav == 'probably' || Modernizr.audio.wav == 'maybe')
					return "wav";
				else if(Modernizr.audio.mp3 == 'probably' || Modernizr.audio.mp3 == 'maybe')
					return "mp3";
				return "";
			}
			
			var image1 = new Image();
			image1.src = "seven.png";
			image1.onload = itemLoaded;
			
			var image2 = new Image();
			image2.src = "oranges.png";
			image2.onload = itemLoaded;
			
			var image3 = new Image();
			image3.src = "grapes.png";
			image3.onload = itemLoaded;
			
			var image4 = new Image();
			image4.src = "diamond.png";
			image4.onload = itemLoaded;

			var image5 = new Image();
			image5.src = "watermelon.png";
			image5.onload = itemLoaded;
						
			var audioElement1 = document.createElement("audio");
			document.body.appendChild(audioElement1);
			
			var audioElement2 = document.createElement("audio");
			document.body.appendChild(audioElement2);
			
			var audioType  = supportedAudioFormat(),
				sound1Loaded = false,
				sound2Loaded = false;
			if (audioType != ""){
				audioElement1.setAttribute("src", "spinning01." + audioType);
				addListener(audioElement1, "canplaythrough", function(){
					if (sound1Loaded) { return; }
					itemLoaded();
					sound1Loaded = true;
					
				});
				audioElement1.load();
				
				audioElement2.setAttribute("src", "cheering01." + audioType);
				addListener(audioElement2, "canplaythrough", function(){
					if (sound2Loaded) { return; }
					itemLoaded();
					sound2Loaded = true;
					
				});
				audioElement2.load();
			}

			addListener(window,"resize",eventWindowResized);
			function eventWindowResized(){
				window.location.reload();
			} 
		}());
		
	}
