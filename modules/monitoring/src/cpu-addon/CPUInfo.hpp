//
//  CPUInfo.hpp
//  cpu-usage
//
//  Created by Vitaliy Orlov on 31.05.16.
//  Copyright © 2016 Vitaliy Orlov. All rights reserved.
//

#ifndef CPUInfo_hpp
#define CPUInfo_hpp

#include <iostream>
#include <vector>
#include <unistd.h>

using namespace std;

struct Ticks {
    unsigned long long int usertime;
    unsigned long long int nicetime;
    unsigned long long int systemtime;
    unsigned long long int idletime;

    Ticks(unsigned long long int usertime,
          unsigned long long int nicetime,
          unsigned long long int systemtime,
          unsigned long long int idletime) {
        this->usertime = usertime;
        this->nicetime = nicetime;
        this->systemtime = systemtime;
        this->idletime = idletime;
    }

    ~Ticks() {}

    inline unsigned long long int used() {
        return usertime + nicetime + systemtime;
    }

    inline unsigned long long int total() {
        return usertime + nicetime + systemtime + idletime;
    }

    static inline float getTotal(Ticks * cur, Ticks * prev) {
        return (float)(cur->used() - prev->used()) / (float)(cur->total() - prev->total()) * 100.0f;
    }

    static inline float getUser(Ticks * cur, Ticks * prev) {
        return (float)(cur->usertime - prev->usertime) / (float)(cur->total() - prev->total()) * 100.0f;
    }

    static inline float getSystem(Ticks * cur, Ticks * prev) {
        return (float)(cur->systemtime - prev->systemtime) / (float)(cur->total() - prev->total()) * 100.0f;
    }
};

template <typename T>
void delete_pointed_to(T* const ptr)
{
    delete ptr;
}

class CPUInfo {
public:
    vector<Ticks *> ticksList;
    vector<Ticks *> prevTicksList;
    CPUInfo() {}

    ~CPUInfo() {
        printf("free\n");
        for_each(ticksList.begin(), ticksList.end(), delete_pointed_to<Ticks>);
        for_each(prevTicksList.begin(), prevTicksList.end(), delete_pointed_to<Ticks>);
    }

    int load() {
        int res = 0;
        if ((res = get_usage())) {
            return res;
        }

        return get_usage();
    }

    inline int isLoad() {
        return ticksList.size() && prevTicksList.size();
    }

    int get_usage() {
        if (ticksList.size()) {
            if (prevTicksList.size()) {
                for_each(prevTicksList.begin(), prevTicksList.end(), delete_pointed_to<Ticks>);
                prevTicksList.clear();
            }

            prevTicksList = ticksList;
            ticksList.clear();

            sleep(1);
        }

        return update();
    }
private:
    int update();
};

#endif /* CPUInfo_hpp */
