#include "NetworkActivity.hpp"

#include <netinet/in.h>
#include <net/if.h>
#include <net/route.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>

#ifdef __APPLE__
    #include <sys/sysctl.h>
#elif __linux__
    #include <netdb.h>
    #include <ifaddrs.h>
    #include <linux/if_link.h>
#endif

int load_interfaces(std::vector<NetworkInterface *> &list) {
    u_int64_t total_ibytes = 0;
    u_int64_t total_obytes = 0;
    u_int64_t total_ipackets = 0;
    u_int64_t total_opackets = 0;

#ifdef __APPLE__
    struct if_nameindex* pIndex = 0;
    struct if_nameindex* pIndex2 = 0;

    char *buf, *lim, *next = NULL;

    int mib[] = {
        CTL_NET,
        PF_ROUTE,
        0,
        0,
        NET_RT_IFLIST2,
        0
    };

    size_t len;
    if (sysctl(mib, 6, NULL, &len, NULL, 0) < 0) {
        //fprintf(stderr, "sysctl: %s\n", strerror(errno));
        return 1;
    }

    buf = (char *)malloc(len);
    if (sysctl(mib, 6, buf, &len, NULL, 0) < 0) {
        //fprintf(stderr, "sysctl: %s\n", strerror(errno));
        return 1;
    }

    lim = buf + len;

    for (next = buf; next < lim; ) {
        struct if_msghdr *ifm = (struct if_msghdr *)next;

        next += ifm->ifm_msglen;

        if (ifm->ifm_type == RTM_IFINFO2) {
            NetworkInterface *ni = new NetworkInterface();
            struct if_msghdr2 *if2m = (struct if_msghdr2 *)ifm;

            ni->index = if2m->ifm_index;
            ni->ibytes = if2m->ifm_data.ifi_ibytes;
            ni->obytes = if2m->ifm_data.ifi_obytes;
            ni->ipackets = if2m->ifm_data.ifi_ipackets;
            ni->opackets = if2m->ifm_data.ifi_opackets;

            total_ibytes += if2m->ifm_data.ifi_ibytes;
            total_obytes += if2m->ifm_data.ifi_obytes;

            total_ipackets += if2m->ifm_data.ifi_ipackets;
            total_opackets += if2m->ifm_data.ifi_opackets;

            list.push_back(ni);
        }
    }

    pIndex = pIndex2 = if_nameindex();

    for (std::vector<NetworkInterface *>::iterator it = list.begin(); it != list.end(); ++it) {
        NetworkInterface *ni = (NetworkInterface *)*it;

        pIndex = pIndex2;
        while ((pIndex != NULL) && (pIndex->if_name != NULL))
        {
            if (pIndex->if_index == ni->index) {
                size_t len = strlen(pIndex->if_name);
                ni->name = (char *)calloc(len + 1, sizeof(char));

                if (ni->name == NULL) {
                    return 1;
                }

                strncpy(ni->name, pIndex->if_name, len);
            }

            ++pIndex;
        }
    }

    if_freenameindex(pIndex2);
#elif __linux__
    struct ifaddrs *ifaddr, *ifa;
    int family, s, n;

    if (getifaddrs(&ifaddr) == -1) {
        return 1;
    }

    for (ifa = ifaddr, n = 0; ifa != NULL; ifa = ifa->ifa_next, n++) {
        if (ifa->ifa_addr == NULL)
            continue;

        family = ifa->ifa_addr->sa_family;

        NetworkInterface *ni = new NetworkInterface();
        size_t len = strlen(ifa->if_name);
        ni->name = (char *)calloc(len + 1, sizeof(char));

        if (ni->name == NULL) {
            return 1;
        }

        strncpy(ni->name, ifa->if_name, len);

        ni->index = n + 1;

        if (family == AF_PACKET && ifa->ifa_data != NULL) {
            struct rtnl_link_stats *stats = (rtnl_link_stats *) ifa->ifa_data;

            ni->ibytes = stats->rx_bytes;
            ni->obytes = stats->tx_bytes;
            ni->ipackets = stats->rx_packets;
            ni->opackets = stats->tx_packets;

            total_ibytes += stats->rx_bytes;
            total_obytes += stats->tx_bytes;

            total_ipackets += stats->rx_packets;
            total_opackets += stats->tx_packets;

            list.push_back(ni);
        }
    }

    freeifaddrs(ifaddr);
#endif
    NetworkInterface *ni = new NetworkInterface();
    ni->name = (char *)calloc(6, sizeof(char));
    strcpy(ni->name, "total");

    ni->ibytes = total_ibytes;
    ni->obytes = total_obytes;
    ni->ipackets = total_ipackets;
    ni->opackets = total_opackets;

    list.push_back(ni);

    return 0;
}