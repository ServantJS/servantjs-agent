//
//  NetworkActivity.hpp
//  cpu-usage
//
//  Created by Vitaliy Orlov on 09.06.16.
//  Copyright © 2016 Vitaliy Orlov. All rights reserved.
//

#ifndef NetworkActivity_hpp
#define NetworkActivity_hpp

#include <vector>

#include <errno.h>
#include <stdlib.h>

struct if_info {
    char *name;
    unsigned short index;
};

class NetworkInterface {
public:
    char *name;
    
    unsigned short index;
    
    u_int64_t	ipackets;
    u_int64_t	opackets;
    u_int64_t	ibytes;
    u_int64_t	obytes;
    
    NetworkInterface() {
        name = NULL;
        index = ipackets = opackets = ibytes = obytes = 0;
    }
    
    ~NetworkInterface() {
        if (name != NULL) {
            free(name);
        }
    }
};

int load_interfaces(std::vector<NetworkInterface *> &);

#endif /* NetworkActivity_hpp */
