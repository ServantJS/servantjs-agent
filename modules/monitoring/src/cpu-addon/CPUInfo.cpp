#include "CPUInfo.hpp"

#ifdef __linux__
#include <fstream>
#endif
#ifdef __APPLE__
#include <mach/mach_host.h>
#include <mach/processor_info.h>
#endif

int CPUInfo::update() {
#ifdef __APPLE__
    unsigned int cpu_count;
    processor_cpu_load_info_t cpu_load;
    mach_msg_type_number_t cpu_msg_count;
    int rc = host_processor_info(mach_host_self(), PROCESSOR_CPU_LOAD_INFO, &cpu_count,
                                 (processor_info_array_t *) &cpu_load, &cpu_msg_count);

    if (rc != 0) {
        return rc;
    }

    for (unsigned int i = 0; i < cpu_count; i++) {
        Ticks *ticks = new Ticks(
            cpu_load[i].cpu_ticks[CPU_STATE_USER],
            cpu_load[i].cpu_ticks[CPU_STATE_NICE],
            cpu_load[i].cpu_ticks[CPU_STATE_SYSTEM],
            cpu_load[i].cpu_ticks[CPU_STATE_IDLE]
        );
        this->ticksList.push_back(ticks);
    }


    return 0;
#elif __linux__

    long double a[4]; // 0 - user, 1 - nice, 2 - system, 4 - idle

    std::ifstream in("/proc/stat");

    if (!in) {
        return 1002;
    }

    std::string line;

    while (std::getline(in, line)) {
        if (line.find("cpu") != std::string::npos && line.find("cpu ") == std::string::npos) {
            std::sscanf(line.c_str(), "%*s %Lf %Lf %Lf %Lf",&a[0],&a[1],&a[2],&a[3]);
            this->ticksList.push_back(new Ticks(a[0], a[1], a[2], a[3]));
        }
    }

    in.close();

    return 0;
#else
    return 1;
#endif
}