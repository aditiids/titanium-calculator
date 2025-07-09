/**
 * HelloWorldApp SDK
 * Copyright TiDev, Inc. 04/07/2022-Present. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 * 
 * WARNING: This is generated code. Modify at your own risk and without support.
 */

@import JavaScriptCore;
@import TitaniumKit.ObjcModule;

@protocol AnalyticsExports <JSExport>

// Properties (and accessors)
READONLY_PROPERTY(NSString *, lastEvent, LastEvent);
PROPERTY(bool, optedOut, OptedOut);

// Methods
JSExportAs(featureEvent,
           -(NSInteger)featureEvent
           : (NSString *)name withData
           : (id)data);
- (void)filterEvents:(NSArray *)events;
JSExportAs(navEvent,
           -(void)navEvent
           : (NSString *)from to
           : (NSString *)to withName
           : (NSString *)name withData
           : (NSDictionary *)data);

@end

@interface AnalyticsModule : ObjcModule <AnalyticsExports>

@end
