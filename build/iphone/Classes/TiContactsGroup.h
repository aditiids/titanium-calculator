/**
 * HelloWorldApp SDK
 * Copyright TiDev, Inc. 04/07/2022-Present. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 * 
 * WARNING: This is generated code. Modify at your own risk and without support.
 */
#ifdef USE_TI_CONTACTS

#import "ContactsModule.h"
#import <Contacts/Contacts.h>
#import <TitaniumKit/TiProxy.h>

@interface TiContactsGroup : TiProxy {
  CNMutableGroup *group;
  ContactsModule *module;
  NSString *identifier;
}

- (id)_initWithPageContext:(id<TiEvaluator>)context contactGroup:(CNMutableGroup *)group_ module:(ContactsModule *)module_;
- (CNSaveRequest *)getSaveRequestForDeletion;
- (CNSaveRequest *)getSaveRequestForAddition:(NSString *)containerIdentifier;

@end
#endif
