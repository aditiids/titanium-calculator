/**
 * HelloWorldApp SDK
 * Copyright TiDev, Inc. 04/07/2022-Present. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 * 
 * WARNING: This is generated code. Modify at your own risk and without support.
 */

#import "TiWindowProxy+Addons.h"

@implementation TiWindowProxy (Addons)

#if defined(USE_TI_UINAVIGATIONWINDOW)
- (TiUINavigationWindowProxy *)navigationWindow
{
  if (parentController != nil && [parentController isKindOfClass:[TiUINavigationWindowProxy class]]) {
    return (TiUINavigationWindowProxy *)parentController;
  }

  return nil;
}
#endif

@end
