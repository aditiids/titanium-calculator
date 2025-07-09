/**
 * HelloWorldApp SDK
 * Copyright TiDev, Inc. 04/07/2022-Present. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 * 
 * WARNING: This is generated code. Modify at your own risk and without support.
 */

#if defined(USE_TI_UINAVIGATIONWINDOW)

@import TitaniumKit.TiWindowProxy;

@interface TiUINavigationWindowProxy : TiWindowProxy <UINavigationControllerDelegate, UIGestureRecognizerDelegate, TiOrientationController, TiTab> {
  @private
  UINavigationController *navController;
  TiWindowProxy *rootWindow;
  TiWindowProxy *current;
  BOOL transitionIsAnimating;
  BOOL transitionWithGesture;

  UIPanGestureRecognizer *fullWidthBackGestureRecognizer;
}

// Private API
- (void)_setFrame:(CGRect)bounds;

@end

#endif
